import { createFileRoute } from '@tanstack/react-router'

/** Erinnert Eltern einmalig, wenn sie der Kursumbuchung 3 Tage nach dem Versand noch nicht zugestimmt haben.
 *  Ändert keine Buchung; setzt nur reminded_at. */
export const Route = createFileRoute('/api/public/hooks/transfer-consent-reminder')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronUnauthorized, isCronAuthorized } = await import('@/lib/cron-auth.server')
        if (!isCronAuthorized(request)) return cronUnauthorized()

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { queueTemplateEmail } = await import('@/lib/email-send.server')
        const sb = supabaseAdmin as any

        const day = 24 * 60 * 60 * 1000
        const olderThan = new Date(Date.now() - 3 * day).toISOString()
        // Nach 30 Tagen keine Erinnerung mehr – ältere offene Fälle klärt der Verein persönlich.
        const newerThan = new Date(Date.now() - 30 * day).toISOString()

        const { data: rows, error } = await sb.from('course_transfer_consents')
          .select('id,token,participant_id,recipient_email,snapshot')
          .eq('status', 'open').is('reminded_at', null)
          .lte('created_at', olderThan).gte('created_at', newerThan)
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

        let sent = 0
        for (const c of (rows ?? []) as any[]) {
          if (!c.recipient_email) continue
          const { data: part } = await sb.from('course_participants').select('status').eq('id', c.participant_id).maybeSingle()
          if (!part || part.status === 'cancelled') continue
          const r = await queueTemplateEmail({
            templateName: 'course-transfer-reminder',
            recipientEmail: c.recipient_email,
            idempotencyKey: `transfer-consent-reminder-${c.id}`,
            metadata: { idempotency_key: `transfer-consent-reminder-${c.id}`, participant_id: c.participant_id },
            templateData: { ...c.snapshot, consent_url: `https://sicher-schwimmen.com/umbuchung?token=${c.token}` },
          })
          if (r.queued) {
            await sb.from('course_transfer_consents').update({ reminded_at: new Date().toISOString() }).eq('id', c.id)
            sent += 1
          }
        }
        return new Response(JSON.stringify({ success: true, candidates: rows?.length ?? 0, sent }), { headers: { 'Content-Type': 'application/json' } })
      },
    },
  },
})
