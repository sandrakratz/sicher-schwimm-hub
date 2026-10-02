import { createFileRoute } from '@tanstack/react-router'

// Täglich am Nachmittag: Teilleistungsnachweise für Kurse, die heute enden.
export const Route = createFileRoute('/api/public/hooks/partial-certificate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronUnauthorized, isCronAuthorized } = await import('@/lib/cron-auth.server')
        if (!isCronAuthorized(request)) return cronUnauthorized()
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { berlinToday, sendPartialCertificate } = await import('@/lib/partial-certificate.server')
        const today = berlinToday()

        // Letzter Kurstag = letzter Termin, sonst Kursende.
        const { data: courses } = await supabaseAdmin
          .from('courses')
          .select('id,ends_on,course_sessions(session_date)')
          .gte('ends_on', addDays(today, -1))
          .lte('ends_on', addDays(today, 60))
        const ending = (courses ?? []).filter((c: any) => {
          const dates = ((c.course_sessions ?? []) as Array<{ session_date: string }>).map(s => s.session_date).sort()
          const last = dates.length ? dates[dates.length - 1] : c.ends_on
          return last === today
        })

        const counts: Record<string, number> = {}
        for (const c of ending) {
          const { data: parts } = await supabaseAdmin
            .from('course_participants')
            .select('id')
            .eq('course_id', c.id)
            .neq('status', 'cancelled')
            .not('exam_level', 'is', null)
          for (const p of parts ?? []) {
            const s = await sendPartialCertificate(p.id)
            counts[s] = (counts[s] ?? 0) + 1
          }
        }
        return new Response(JSON.stringify({ success: true, date: today, courses: ending.length, counts }), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
