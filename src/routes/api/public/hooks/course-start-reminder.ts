import { createFileRoute } from '@tanstack/react-router'

function berlinTodayPlus(days: number): string {
  const now = new Date()
  const berlin = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }))
  berlin.setDate(berlin.getDate() + days)
  const y = berlin.getFullYear()
  const m = String(berlin.getMonth() + 1).padStart(2, '0')
  const d = String(berlin.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const Route = createFileRoute('/api/public/hooks/course-start-reminder')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get('apikey') ?? ''
        const accepted = [
          process.env['SUPABASE_ANON_KEY'],
          process.env['SUPABASE_PUBLISHABLE_KEY'],
        ].filter(Boolean) as string[]
        if (accepted.length === 0 || !apiKey || !accepted.includes(apiKey)) {
          return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { queueTemplateEmail } = await import('@/lib/email-send.server')

        const targetDate = berlinTodayPlus(3)

        const { data: courses, error } = await supabaseAdmin
          .from('courses')
          .select('id,name,location,schedule,starts_on,course_info,course_programs(name,location,course_info)')
          .eq('starts_on', targetDate)
          .is('archived_at', null)

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        let queued = 0
        let candidates = 0

        for (const c of courses ?? []) {
          const program = (c as any).course_programs as
            | { name?: string; location?: string | null; course_info?: string | null }
            | null

          const { data: sessions } = await supabaseAdmin
            .from('course_sessions')
            .select('session_date,start_time,end_time')
            .eq('course_id', c.id)
            .order('session_date', { ascending: true })
            .limit(1)

          const first = sessions?.[0]
          const firstDate = first?.session_date ?? c.starts_on
          // Elternzeiten kommen bewusst aus dem Zeitplan des Kurses,
          // die Terminzeiten sind die internen Trainer-Zeiten.
          const firstTime: string | null = null

          const { data: participants } = await supabaseAdmin
            .from('course_participants')
            .select('id,participant_name,participant_email,request_id,course_requests(parent_name)')
            .eq('course_id', c.id)
            .eq('status', 'confirmed')

          for (const p of participants ?? []) {
            if (!p.participant_email) continue
            candidates += 1
            const idempotencyKey = `course-start-${p.id}`

            const { data: existing } = await supabaseAdmin
              .from('email_send_log')
              .select('id')
              .eq('template_name', 'course-start-reminder')
              .contains('metadata', { idempotency_key: idempotencyKey })
              .limit(1)
            if (existing && existing.length > 0) continue

            const result = await queueTemplateEmail({
              templateName: 'course-start-reminder',
              recipientEmail: p.participant_email,
              idempotencyKey,
              metadata: { participant_id: p.id, course_id: c.id },
              templateData: {
                parent_name:
                  ((p as any).course_requests?.parent_name as string | null) ?? null,
                child_name: p.participant_name,
                course_name: c.name,
                program_name: program?.name ?? null,
                course_location: c.location ?? program?.location ?? null,
                course_schedule: c.schedule ?? null,
                first_session_date: firstDate,
                first_session_time: firstTime,
                course_info: (c as any).course_info ?? program?.course_info ?? null,
              },
            })
            if (result.queued) queued += 1
          }
        }

        return new Response(
          JSON.stringify({ success: true, date: targetDate, courses: courses?.length ?? 0, candidates, queued }),
          { headers: { 'Content-Type': 'application/json' } },
        )
      },
    },
  },
})
