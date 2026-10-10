import { createFileRoute } from '@tanstack/react-router'

/** Täglich werktags früh: „Das liegt heute bei dir“ an jedes Vorstandsmitglied (nur wenn etwas offen ist). */
export const Route = createFileRoute('/api/public/hooks/daily-digest')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronUnauthorized, isCronAuthorized } = await import('@/lib/cron-auth.server')
        if (!isCronAuthorized(request)) return cronUnauthorized()

        const { buildDigests } = await import('@/lib/digest.server')
        const { queueTemplateEmail } = await import('@/lib/email-send.server')
        const today = new Date().toISOString().slice(0, 10)

        let sent = 0
        const digests = await buildDigests()
        for (const d of digests) {
          const r = await queueTemplateEmail({
            templateName: 'daily-digest',
            recipientEmail: d.email,
            idempotencyKey: `daily-digest-${d.userId}-${today}`,
            templateData: { first_name: d.firstName, lines: d.lines },
          })
          if (r.queued) sent++
        }
        return new Response(JSON.stringify({ ok: true, recipients: digests.length, sent }), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
