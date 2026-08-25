// Server-only Helfer zum Rendern und Versenden von Transaktions-E-Mails
// über die verwaltete Lovable-E-Mail-Zustellung.
import * as React from 'react'
import { render } from '@react-email/components'
import { EmailAPIError, sendLovableEmail } from '@lovable.dev/email-js'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'Sicher Schwimmen e.V.'
const SENDER_DOMAIN = 'notify.sicher-schwimmen.com'
const FROM_DOMAIN = 'notify.sicher-schwimmen.com'

export interface SendRawEmailOptions {
  /** Label/Vorlagenname für das Sendeprotokoll. */
  templateName: string
  recipientEmail: string
  subject: string
  html: string
  text: string
  idempotencyKey: string
  senderUserId?: string | null
  replyTo?: string
  metadata?: Record<string, unknown> | null
}

/**
 * Versendet eine bereits gerenderte E-Mail und protokolliert das Ergebnis in
 * `email_send_log` (inkl. Betreff und Inhalt für die Gesprächsverläufe).
 */
export async function sendRawEmail(
  opts: SendRawEmailOptions,
): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env['LOVABLE_API_KEY']
  if (!apiKey) throw new Error('LOVABLE_API_KEY is not configured')

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const messageId = crypto.randomUUID()
  const logMetadata = { idempotency_key: opts.idempotencyKey, ...(opts.metadata ?? {}) }

  const logRow = {
    message_id: messageId,
    template_name: opts.templateName,
    recipient_email: opts.recipientEmail,
    subject: opts.subject,
    body_html: opts.html,
    body_text: opts.text,
    sender_user_id: opts.senderUserId ?? null,
    metadata: logMetadata,
  }

  try {
    await sendLovableEmail(
      {
        to: opts.recipientEmail,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        purpose: 'transactional',
        label: opts.templateName,
        idempotency_key: opts.idempotencyKey,
        reply_to: opts.replyTo,
      },
      { apiKey, sendUrl: process.env['LOVABLE_SEND_URL'] },
    )
  } catch (error) {
    if (error instanceof EmailAPIError && error.code === 'recipient_suppressed') {
      const { error: logErr } = await supabaseAdmin
        .from('email_send_log')
        .insert({ ...logRow, status: 'suppressed' })
      if (logErr) console.error('email_send_log insert failed', logErr)
      return { sent: false, reason: 'suppressed' }
    }
    const message = error instanceof Error ? error.message : String(error)
    const { error: logErr } = await supabaseAdmin
      .from('email_send_log')
      .insert({ ...logRow, status: 'failed', error_message: message.slice(0, 1000) })
    if (logErr) console.error('email_send_log insert failed', logErr)
    return { sent: false, reason: 'send_failed' }
  }

  const { error: logErr } = await supabaseAdmin
    .from('email_send_log')
    .insert({ ...logRow, status: 'sent' })
  if (logErr) console.error('email_send_log insert failed', logErr)

  return { sent: true }
}

/**
 * Rendert eine registrierte Vorlage und versendet sie.
 * Rückgabewert bleibt aus Kompatibilitätsgründen `{ queued }`.
 */
export async function queueTemplateEmail(opts: {
  templateName: string
  recipientEmail?: string | null
  templateData: Record<string, unknown>
  idempotencyKey: string
  senderUserId?: string | null
  replyTo?: string
  /** Zusätzliche Metadaten im Sendeprotokoll (z. B. zur Dedupe-Prüfung). */
  metadata?: Record<string, unknown> | null
}): Promise<{ queued: boolean; reason?: string }> {
  const tpl = TEMPLATES[opts.templateName]
  if (!tpl) return { queued: false, reason: 'unknown_template' }

  const recipient = (tpl.to || opts.recipientEmail || '').trim()
  if (!recipient) return { queued: false, reason: 'no_recipient' }

  const element = React.createElement(tpl.component, opts.templateData as Record<string, unknown>)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject =
    typeof tpl.subject === 'function' ? tpl.subject(opts.templateData as Record<string, any>) : tpl.subject

  const result = await sendRawEmail({
    templateName: opts.templateName,
    recipientEmail: recipient,
    subject,
    html,
    text,
    idempotencyKey: opts.idempotencyKey,
    senderUserId: opts.senderUserId ?? null,
    replyTo: opts.replyTo,
    metadata: opts.metadata ?? null,
  })

  return { queued: result.sent, reason: result.reason }
}
