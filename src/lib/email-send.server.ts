// Server-only Helfer zum Rendern und Einreihen von Transaktions-E-Mails.
import * as React from 'react'
import { render } from '@react-email/components'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'Sicher Schwimmen e.V.'
const SENDER_DOMAIN = 'notify.sicher-schwimmen.com'
const FROM_DOMAIN = 'notify.sicher-schwimmen.com'

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
}

export async function queueTemplateEmail(opts: {
  templateName: string
  recipientEmail?: string | null
  templateData: Record<string, unknown>
  idempotencyKey: string
  senderUserId?: string | null
  /** Zusätzliche Metadaten im Sendeprotokoll (z. B. zur Dedupe-Prüfung). */
  metadata?: Record<string, unknown> | null
}): Promise<{ queued: boolean; reason?: string }> {
  const tpl = TEMPLATES[opts.templateName]
  if (!tpl) return { queued: false, reason: 'unknown_template' }

  const recipient = (tpl.to || opts.recipientEmail || '').trim()
  if (!recipient) return { queued: false, reason: 'no_recipient' }

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const normalizedEmail = recipient.toLowerCase()

  const { data: suppressed } = await supabaseAdmin
    .from('suppressed_emails')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()
  if (suppressed) return { queued: false, reason: 'suppressed' }

  let unsubscribeToken = generateToken()
  const { data: existingToken } = await supabaseAdmin
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()
  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    await supabaseAdmin
      .from('email_unsubscribe_tokens')
      .upsert({ token: unsubscribeToken, email: normalizedEmail }, { onConflict: 'email', ignoreDuplicates: true })
    const { data: stored } = await supabaseAdmin
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()
    if (stored?.token) unsubscribeToken = stored.token
  } else {
    return { queued: false, reason: 'unsubscribed' }
  }

  const element = React.createElement(tpl.component, opts.templateData as Record<string, unknown>)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject =
    typeof tpl.subject === 'function' ? tpl.subject(opts.templateData as Record<string, any>) : tpl.subject
  const messageId = crypto.randomUUID()

  await supabaseAdmin.from('email_send_log').insert({
    message_id: messageId,
    template_name: opts.templateName,
    recipient_email: recipient,
    status: 'pending',
    subject,
    body_html: html,
    body_text: text,
    sender_user_id: opts.senderUserId ?? null,
  })

  const { error: enqErr } = await supabaseAdmin.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: opts.templateName,
      idempotency_key: opts.idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqErr) {
    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: opts.templateName,
      recipient_email: recipient,
      status: 'failed',
      error_message: enqErr.message,
    })
    return { queued: false, reason: 'enqueue_failed' }
  }

  return { queued: true }
}
