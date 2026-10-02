import { createFileRoute } from '@tanstack/react-router'

/**
 * Cron-Hook: schließt abgelaufene Platzangebote und vergibt frei gewordene
 * Plätze automatisch an die nächsten Familien auf der Warteliste.
 */
export const Route = createFileRoute('/api/public/hooks/waitlist-sweep')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronUnauthorized, isCronAuthorized } = await import('@/lib/cron-auth.server')
        if (!isCronAuthorized(request)) return cronUnauthorized()

        try {
          const { allocateWaitlist, expireFollowups, sendMissingFollowups } = await import('@/lib/waitlist.server')
          const followupsSent = await sendMissingFollowups()
          const followupsExpired = await expireFollowups()
          const result = await allocateWaitlist(null)
          return Response.json({ ok: true, offers: result.offers.length, expired: result.expired, followupsSent, followupsExpired })
        } catch (err) {
          console.error('waitlist sweep failed', err)
          return new Response(JSON.stringify({ ok: false }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
