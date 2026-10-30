import { createFileRoute } from '@tanstack/react-router'

/** Täglich abends: Erinnerung an die Einsätze von morgen, sonntags die Wochenvorschau (an Trainer:innen). */
export const Route = createFileRoute('/api/public/hooks/trainer-reminders')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronUnauthorized, isCronAuthorized } = await import('@/lib/cron-auth.server')
        if (!isCronAuthorized(request)) return cronUnauthorized()

        const { runTrainerReminders } = await import('@/lib/trainer-reminders.server')
        const result = await runTrainerReminders()
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
