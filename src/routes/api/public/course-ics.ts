import { createFileRoute } from '@tanstack/react-router'

// Kalenderdatei (.ics) mit allen Terminen eines öffentlichen Kurses – der Link steht in der Kursbestätigung.
// Enthält nur Kursname, Ort und Termine (keine personenbezogenen Daten).
export const Route = createFileRoute('/api/public/course-ics')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get('course') || ''
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
          return new Response('Not found', { status: 404 })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { data: course } = await supabaseAdmin
          .from('courses')
          .select('id,name,location,schedule,is_public,archived_at,course_programs(name,location)')
          .eq('id', id)
          .maybeSingle()
        if (!course || !course.is_public || course.archived_at) {
          return new Response('Not found', { status: 404 })
        }

        const { loadCourseSessionsForMail } = await import('@/lib/course-session-mail.server')
        const { buildIcs } = await import('@/lib/ics')
        const sessions = await loadCourseSessionsForMail(course.id, course.schedule)
        if (sessions.length === 0) return new Response('Not found', { status: 404 })

        const program = (course as any).course_programs as { name?: string; location?: string } | null
        const title = program?.name || course.name
        const location = course.location || program?.location || ''
        const ics = buildIcs(
          sessions.map((s, i) => ({
            id: `${course.id}-${i + 1}`,
            date: s.date,
            title,
            location,
            description: `${i + 1}. Termin – Sicher Schwimmen e.V.`,
            start: s.start,
            end: s.end,
          })),
          `Sicher Schwimmen – ${title}`,
        )

        return new Response(ics, {
          headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': 'attachment; filename="kurstermine.ics"',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
