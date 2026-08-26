import { createFileRoute } from '@tanstack/react-router'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function lookupToken(token: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data, error } = await supabaseAdmin
    .from('email_unsubscribe_tokens')
    .select('token, email, used_at, expires_at')
    .eq('token', token)
    .maybeSingle()
  return { supabaseAdmin, row: data, error }
}

export const Route = createFileRoute('/email/unsubscribe')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get('token')
        if (!token) return json({ valid: false, reason: 'invalid_token' })

        const { row, error } = await lookupToken(token)
        if (error) {
          console.error('unsubscribe lookup failed', { code: error.code, message: error.message })
          return json({ valid: false, reason: 'error' }, 500)
        }
        if (!row) return json({ valid: false, reason: 'invalid_token' })
        if (row.expires_at && new Date(row.expires_at) < new Date()) {
          return json({ valid: false, reason: 'invalid_token' })
        }
        if (row.used_at) return json({ valid: false, reason: 'already_unsubscribed' })
        return json({ valid: true })
      },

      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { token?: string }
        const token = typeof body.token === 'string' ? body.token : null
        if (!token) return json({ success: false, reason: 'invalid_token' })

        const { supabaseAdmin, row, error } = await lookupToken(token)
        if (error) {
          console.error('unsubscribe lookup failed', { code: error.code, message: error.message })
          return json({ success: false, reason: 'error' }, 500)
        }
        if (!row) return json({ success: false, reason: 'invalid_token' })
        if (row.expires_at && new Date(row.expires_at) < new Date()) {
          return json({ success: false, reason: 'invalid_token' })
        }

        const email = String(row.email).toLowerCase()

        if (!row.used_at) {
          const { error: usedError } = await supabaseAdmin
            .from('email_unsubscribe_tokens')
            .update({ used_at: new Date().toISOString() })
            .eq('token', token)
          if (usedError) {
            console.error('unsubscribe token update failed', {
              code: usedError.code,
              message: usedError.message,
            })
            return json({ success: false, reason: 'error' }, 500)
          }
        }

        const { error: suppressError } = await supabaseAdmin
          .from('suppressed_emails')
          .upsert({ email, reason: 'unsubscribe', metadata: null }, { onConflict: 'email' })
        if (suppressError) {
          console.error('unsubscribe suppression failed', {
            code: suppressError.code,
            message: suppressError.message,
          })
          return json({ success: false, reason: 'error' }, 500)
        }

        if (row.used_at) return json({ success: false, reason: 'already_unsubscribed' })
        return json({ success: true })
      },
    },
  },
})
