import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/hooks/payment-check-reminder')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get('apikey') ?? ''
        const expected = process.env['SUPABASE_ANON_KEY'] ?? ''
        if (!expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { queueTemplateEmail } = await import('@/lib/email-send.server')

        const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

        const { data: participants, error } = await supabaseAdmin
          .from('course_participants')
          .select(
            'id,participant_name,participant_email,price_amount,document_no,created_at,course_id,courses(name,starts_on,ends_on,course_programs(name))',
          )
          .eq('online_booking', true)
          .eq('status', 'confirmed')
          .eq('paid', false)
          .lte('created_at', cutoff)

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        let queued = 0
        for (const p of participants ?? []) {
          const course = (p as any).courses as
            | { name?: string; starts_on?: string | null; ends_on?: string | null; course_programs?: { name?: string } | null }
            | null

          const result = await queueTemplateEmail({
            templateName: 'payment-check-reminder',
            idempotencyKey: `payment-check-${p.id}`,
            templateData: {
              child_name: p.participant_name,
              parent_email: p.participant_email,
              parent_name: p.participant_name,
              program_name: course?.course_programs?.name ?? null,
              course_name: course?.name ?? null,
              course_starts_on: course?.starts_on ?? null,
              course_ends_on: course?.ends_on ?? null,
              booked_at: p.created_at,
              price_amount: p.price_amount,
              document_no: p.document_no,
              payment_reference: p.document_no
                ? `${p.document_no} / ${p.participant_name ?? ''}`.trim()
                : (p.participant_name ?? null),
            },
          })
          if (result.queued) queued += 1
        }

        return new Response(
          JSON.stringify({ success: true, candidates: participants?.length ?? 0, queued }),
          { headers: { 'Content-Type': 'application/json' } },
        )
      },
    },
  },
})
