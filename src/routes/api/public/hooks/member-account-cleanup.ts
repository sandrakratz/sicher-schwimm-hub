import { createFileRoute } from '@tanstack/react-router'

/**
 * Cron-Hook: löscht die Logins von Mitgliedern, deren Mitgliedschaft (Feld „gültig bis“) seit
 * mindestens 30 Tagen abgelaufen ist. Trainer-/Vorstandskonten und Konten mit laufenden Kursen bleiben.
 */
export const Route = createFileRoute('/api/public/hooks/member-account-cleanup')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronUnauthorized, isCronAuthorized } = await import('@/lib/cron-auth.server')
        if (!isCronAuthorized(request)) return cronUnauthorized()

        try {
          const { deleteExpiredMemberAccounts } = await import('@/lib/member-account-cleanup.server')
          const result = await deleteExpiredMemberAccounts()
          return Response.json({ ok: true, ...result })
        } catch (err) {
          console.error('member account cleanup failed', err)
          return new Response(JSON.stringify({ ok: false }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
