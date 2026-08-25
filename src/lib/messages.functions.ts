import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const SITE_NAME = 'Sicher Schwimmen e.V.'
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

    const { sendRawEmail } = await import('@/lib/email-send.server')
    const result = await sendRawEmail({
      templateName: 'message-reply',
      recipientEmail: recipient,
      subject,
      html,
      text,
      replyTo: REPLY_TO,
      senderUserId: userId,
      idempotencyKey: `msg-reply-${data.messageId}-${Date.now()}`,
    })
    if (!result.sent) {
      throw new Error(
        result.reason === 'suppressed'
          ? 'Empfänger hat sich abgemeldet'
          : 'E-Mail konnte nicht versendet werden',
      )
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
