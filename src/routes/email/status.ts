import { createFileRoute } from '@tanstack/react-router'

/**
 * Diagnose-Seite für die Einrichtung: zeigt für jede erwartete Einstellung nur OK / FEHLT / FORMAT?,
 * niemals den Wert selbst. Hilft, falsch oder am falschen Ort eingetragene Variablen bei Cloudflare zu finden.
 */
const CHECKS: { name: string; ok: (v: string) => boolean }[] = [
  { name: 'SUPABASE_URL', ok: (v) => /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(v) },
  { name: 'SUPABASE_PUBLISHABLE_KEY', ok: (v) => v.startsWith('sb_publishable_') || v.startsWith('eyJ') },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', ok: (v) => v.startsWith('sb_secret_') || v.startsWith('eyJ') },
  { name: 'RESEND_API_KEY', ok: (v) => v.startsWith('re_') },
  { name: 'VAPID_SEED', ok: (v) => v.length >= 20 },
  { name: 'SEND_EMAIL_HOOK_SECRET', ok: (v) => v.startsWith('v1,whsec_') },
  { name: 'RESEND_WEBHOOK_SECRET', ok: (v) => v.startsWith('whsec_') },
]

export const Route = createFileRoute('/email/status')({
  server: {
    handlers: {
      GET: async () => {
        const lines = CHECKS.map(({ name, ok }) => {
          const value = process.env[name]
          if (!value) return `FEHLT    ${name}`
          if (value !== value.trim() || /["']/.test(value)) return `FORMAT?  ${name} (Leerzeichen oder Anführungszeichen am Rand?)`
          return ok(value) ? `OK       ${name}` : `FORMAT?  ${name} (Wert sieht ungewöhnlich aus)`
        })
        return new Response(lines.join('\n') + '\n', {
          headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
        })
      },
    },
  },
})
