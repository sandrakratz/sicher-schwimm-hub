import { createFileRoute } from '@tanstack/react-router'

// Persönlicher Kalender-Feed (.ics) für Trainer:innen: alle eigenen Einteilungen, aktuell gehalten.
// Zugriff nur mit dem geheimen Token aus dem Trainerbereich; enthält nur Kurs, Ort und Zeit.
export const Route = createFileRoute('/api/public/trainer-ics')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get('token') || ''
        if (!/^[0-9a-f]{48}$/.test(token)) return new Response('Not found', { status: 404 })

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const db = supabaseAdmin as any
        const { data: row } = await db
          .from('trainer_calendar_tokens')
          .select('trainer_id')
          .eq('token', token)
          .maybeSingle()
        if (!row?.trainer_id) return new Response('Not found', { status: 404 })
        const me = row.trainer_id as string

        const { fetchAll, fetchIn } = await import('@/lib/fetch-all')
        const { buildIcs, parseTimeRange } = await import('@/lib/ics')
        const from = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10)
        const SELECT =
          'id,session_index,session_date,start_time,end_time,courses(name,location,schedule,duration)'

        const assigned = await fetchAll<{ session_id: string }>((f, t) =>
          db.from('course_session_assignments').select('session_id').eq('trainer_id', me).order('id').range(f, t),
        )
        const ownCourses = await fetchAll<{ id: string }>((f, t) =>
          db.from('courses').select('id').eq('trainer_id', me).order('id').range(f, t),
        )
        const [a, b, c] = await Promise.all([
          fetchIn<any>(assigned.map((x) => x.session_id), (chunk, f, t) =>
            db.from('course_sessions').select(SELECT).in('id', chunk).gte('session_date', from).order('id').range(f, t),
          ),
          fetchAll<any>((f, t) =>
            db.from('course_sessions').select(SELECT).eq('assigned_trainer_id', me).gte('session_date', from).order('id').range(f, t),
          ),
          fetchIn<any>(ownCourses.map((x) => x.id), (chunk, f, t) =>
            db.from('course_sessions').select(SELECT).in('course_id', chunk).gte('session_date', from).order('id').range(f, t),
          ),
        ])
        const byId = new Map<string, any>()
        for (const s of [...a, ...b, ...c]) byId.set(s.id, s)

        const items = [...byId.values()]
          .sort((x, y) => x.session_date.localeCompare(y.session_date))
          .map((s) => {
            const course = s.courses ?? {}
            const t = s.start_time
              ? { start: String(s.start_time).slice(0, 5), end: s.end_time ? String(s.end_time).slice(0, 5) : null }
              : parseTimeRange(course.schedule, course.duration)
            return {
              id: `einsatz-${s.id}`,
              date: s.session_date as string,
              title: `Einsatz: ${course.name ?? 'Kurs'}`,
              location: (course.location as string) ?? '',
              description: `${s.session_index}. Termin – Sicher Schwimmen e.V.`,
              start: t?.start ?? null,
              end: t?.end ?? null,
            }
          })

        return new Response(buildIcs(items, 'Sicher Schwimmen – meine Einsätze'), {
          headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Cache-Control': 'private, no-store',
            'X-Robots-Tag': 'noindex',
          },
        })
      },
    },
  },
})
