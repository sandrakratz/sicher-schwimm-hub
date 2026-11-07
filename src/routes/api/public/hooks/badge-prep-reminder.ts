import { createFileRoute } from '@tanstack/react-router'

/** Täglich um 18 Uhr: Trainer:innen erinnern, dass übermorgen die letzte Kursstunde ist (Abzeichen vorbereiten). */
export const Route = createFileRoute('/api/public/hooks/badge-prep-reminder')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronUnauthorized, isCronAuthorized } = await import('@/lib/cron-auth.server')
        if (!isCronAuthorized(request)) return cronUnauthorized()

        const { runBadgePrepReminders } = await import('@/lib/badge-prep-reminder.server')
        const result = await runBadgePrepReminders()
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
