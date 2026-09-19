import { createFileRoute } from '@tanstack/react-router'

/** Datum in Berliner Zeit, um `days` Tage verschoben (YYYY-MM-DD). */
function berlinTodayPlus(days: number): string {
  const now = new Date()
  const berlin = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }))
  berlin.setDate(berlin.getDate() + days)
  const y = berlin.getFullYear()
  const m = String(berlin.getMonth() + 1).padStart(2, '0')
  const d = String(berlin.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const Route = createFileRoute('/api/public/hooks/payment-check-reminder')({
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

        const inThreeDays = berlinTodayPlus(3)
        const tomorrow = berlinTodayPlus(1)

        const { data: participants, error } = await supabaseAdmin
          .from('course_participants')
          .select(
            'id,participant_name,participant_email,price_amount,document_no,document_issued_at,created_at,payment_due_date,payer_street,payer_zip,payer_city,course_id,courses(name,starts_on,ends_on,schedule,location,unit_count,payment_due_days,course_programs(name))',
          )
          .eq('online_booking', true)
          .eq('status', 'confirmed')
          .eq('paid', false)
          .in('payment_due_date', [inThreeDays, tomorrow])

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        /** Prüft, ob eine Vorlage für diesen Vorgang bereits versendet wurde. */
        async function alreadySent(templateName: string, idempotencyKey: string) {
          const { data } = await supabaseAdmin
            .from('email_send_log')
            .select('id')
            .eq('template_name', templateName)
            .contains('metadata', { idempotency_key: idempotencyKey })
            .limit(1)
          return Boolean(data && data.length > 0)
        }

        let queuedInternal = 0
        let queuedFriendly = 0
        let queuedFinal = 0

        for (const p of participants ?? []) {
          const course = (p as any).courses as
            | {
                name?: string
                starts_on?: string | null
                ends_on?: string | null
                schedule?: string | null
                location?: string | null
                unit_count?: number | null
                payment_due_days?: number | null
                course_programs?: { name?: string } | null
              }
            | null

          const isFinal = p.payment_due_date === tomorrow
          const email = (p.participant_email || '').trim()
          const paymentReference = p.document_no
            ? `${p.document_no} / ${p.participant_name ?? ''}`.trim()
            : (p.participant_name ?? null)

          // Interne Prüf-Mail an den Verein – 3 Tage vor Fristablauf, einmalig.
          if (!isFinal) {
            const internalKey = `payment-check-${p.id}`
            if (!(await alreadySent('payment-check-reminder', internalKey))) {
              const res = await queueTemplateEmail({
                templateName: 'payment-check-reminder',
                idempotencyKey: internalKey,
                metadata: { participant_id: p.id },
                templateData: {
                  child_name: p.participant_name,
                  parent_email: p.participant_email,
                  parent_name: p.participant_name,
                  program_name: course?.course_programs?.name ?? null,
                  course_name: course?.name ?? null,
                  course_starts_on: course?.starts_on ?? null,
                  course_ends_on: course?.ends_on ?? null,
                  booked_at: p.created_at,
                  payment_due_date: p.payment_due_date,
                  price_amount: p.price_amount,
                  document_no: p.document_no,
                  payment_reference: paymentReference,
                },
              })
              if (res.queued) queuedInternal += 1
            }
          }

          if (!email) continue

          const templateName = isFinal ? 'payment-due-final' : 'payment-due-friendly'
          const key = `${templateName}-${p.id}`
          if (await alreadySent(templateName, key)) continue

          const res = await queueTemplateEmail({
            templateName,
            recipientEmail: email,
            idempotencyKey: key,
            metadata: { participant_id: p.id },
            templateData: {
              document_no: p.document_no,
              issued_at: p.document_issued_at ?? p.created_at,
              payer_name: p.participant_name,
              payer_street: p.payer_street,
              payer_zip: p.payer_zip,
              payer_city: p.payer_city,
              child_name: p.participant_name,
              course_name: course?.name ?? null,
              program_name: course?.course_programs?.name ?? null,
              starts_on: course?.starts_on ?? null,
              ends_on: course?.ends_on ?? null,
              schedule: course?.schedule ?? null,
              location: course?.location ?? null,
              unit_count: course?.unit_count ?? null,
              price_amount: p.price_amount != null ? Number(p.price_amount) : null,
              payment_due_days: course?.payment_due_days ?? null,
              payment_due_date: p.payment_due_date,
            },
          })
          if (res.queued) {
            if (isFinal) queuedFinal += 1
            else queuedFriendly += 1
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            candidates: participants?.length ?? 0,
            queued: queuedInternal + queuedFriendly + queuedFinal,
            queuedInternal,
            queuedFriendly,
            queuedFinal,
          }),
          { headers: { 'Content-Type': 'application/json' } },
        )
      },
    },
  },
})
