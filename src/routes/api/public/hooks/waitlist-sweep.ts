import { createFileRoute } from '@tanstack/react-router'

/**
 * Cron-Hook: schließt abgelaufene Platzangebote und vergibt frei gewordene
 * Plätze automatisch an die nächsten Familien auf der Warteliste.
 */
export const Route = createFileRoute('/api/public/hooks/waitlist-sweep')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get('apikey') ?? ''
        const expected = process.env['SUPABASE_ANON_KEY'] ?? process.env['SUPABASE_PUBLISHABLE_KEY'] ?? ''
        if (!expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        try {
          const { allocateWaitlist } = await import('@/lib/waitlist.server')
          const result = await allocateWaitlist(null)
          return Response.json({ ok: true, offers: result.offers.length, expired: result.expired })
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
