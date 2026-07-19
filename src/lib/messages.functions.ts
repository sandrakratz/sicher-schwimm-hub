import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const SITE_NAME = 'Sicher Schwimmen e.V.'
const SENDER_DOMAIN = 'notify.sicher-schwimmen.com'
const FROM_DOMAIN = 'notify.sicher-schwimmen.com'
const REPLY_TO = 'info@sicher-schwimmen.com'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const replyToMessage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messageId: string; body: string; subject?: string }) => {
    if (!input.messageId) throw new Error('messageId erforderlich')
    const body = (input.body || '').trim()
    if (body.length < 2) throw new Error('Nachricht zu kurz')
    if (body.length > 10000) throw new Error('Nachricht zu lang')
    return { messageId: input.messageId, body, subject: (input.subject || '').trim().slice(0, 300) }
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    const { data: isStaff } = await supabase.rpc('is_staff', { _user_id: userId })
    if (!isStaff) throw new Error('Forbidden')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const { data: msg, error: msgErr } = await supabaseAdmin
      .from('messages').select('*').eq('id', data.messageId).maybeSingle()
    if (msgErr || !msg) throw new Error('Nachricht nicht gefunden')
    if (!msg.from_email) throw new Error('Keine Absender-E-Mail')

    const recipient = msg.from_email as string
    const normalizedEmail = recipient.toLowerCase()

    const { data: suppressed } = await supabaseAdmin
      .from('suppressed_emails').select('id').eq('email', normalizedEmail).maybeSingle()
    if (suppressed) throw new Error('Empfänger hat sich abgemeldet')

    const subject = data.subject || `Re: ${msg.subject || 'Ihre Nachricht'}`
    const escapedBody = escapeHtml(data.body).replace(/\n/g, '<br />')
    const escapedOriginal = escapeHtml(msg.body || '').replace(/\n/g, '<br />')

    const html = `<!doctype html><html lang="de"><body style="font-family:Arial,sans-serif;color:#0f172a;background:#fff;padding:24px;">
<div style="max-width:600px;margin:0 auto;">
  <p>${escapedBody}</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
  <p style="font-size:12px;color:#64748b;">Mit freundlichen Grüßen<br />${SITE_NAME}</p>
  <div style="margin-top:24px;padding:12px;background:#f1f5f9;border-radius:6px;font-size:12px;color:#475569;">
    <div style="font-weight:600;margin-bottom:6px;">Ihre ursprüngliche Nachricht:</div>
    <div><em>Betreff:</em> ${escapeHtml(msg.subject || '—')}</div>
    <div style="margin-top:8px;">${escapedOriginal}</div>
  </div>
</div></body></html>`

    const text = `${data.body}\n\n--\n${SITE_NAME}\n\n--- Ihre ursprüngliche Nachricht ---\nBetreff: ${msg.subject || '—'}\n\n${msg.body || ''}`

    let unsubscribeToken: string
    const { data: existingToken } = await supabaseAdmin
      .from('email_unsubscribe_tokens')
      .select('token, used_at').eq('email', normalizedEmail).maybeSingle()
    if (existingToken && !existingToken.used_at) {
      unsubscribeToken = existingToken.token
    } else {
      unsubscribeToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
      await supabaseAdmin.from('email_unsubscribe_tokens').upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: 'email', ignoreDuplicates: true },
      )
      const { data: stored } = await supabaseAdmin
        .from('email_unsubscribe_tokens').select('token').eq('email', normalizedEmail).maybeSingle()
      if (stored?.token) unsubscribeToken = stored.token
    }

    const messageId = crypto.randomUUID()
    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'message-reply',
      recipient_email: recipient,
      status: 'pending',
    })

    const { error: enqErr } = await supabaseAdmin.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        to: recipient,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        reply_to: REPLY_TO,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: 'transactional',
        label: 'message-reply',
        idempotency_key: `msg-reply-${data.messageId}-${Date.now()}`,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    })

    if (enqErr) {
      await supabaseAdmin.from('email_send_log').insert({
        message_id: messageId,
        template_name: 'message-reply',
        recipient_email: recipient,
        status: 'failed',
        error_message: enqErr.message,
      })
      throw new Error(enqErr.message)
    }

    await supabaseAdmin.from('messages').update({ status: 'replied' }).eq('id', data.messageId)

    const { logAudit } = await import('@/lib/audit.server')
    await logAudit(supabase, userId, {
      action: 'message.replied',
      entity: 'messages',
      entity_id: data.messageId,
      metadata: { recipient },
    })

    return { ok: true }
  })
