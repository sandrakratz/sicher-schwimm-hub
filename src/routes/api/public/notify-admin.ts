import * as React from 'react'
import { render } from '@react-email/components'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'Sicher Schwimmen e.V.'
const SENDER_DOMAIN = 'notify.sicher-schwimmen.com'
const FROM_DOMAIN = 'notify.sicher-schwimmen.com'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Public endpoint that sends a notification email to the fixed admin recipient
// defined in the template (`template.to`). Only templates that declare a
// fixed `to` address are accepted, so this endpoint cannot be abused to send
// mail to arbitrary recipients.
export const Route = createFileRoute('/api/public/notify-admin')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        let templateName: string
        let templateData: Record<string, any> = {}
        let idempotencyKey: string | undefined
        try {
          const body = await request.json()
          templateName = String(body.templateName || '')
          if (body.templateData && typeof body.templateData === 'object') templateData = body.templateData
          if (body.idempotencyKey) idempotencyKey = String(body.idempotencyKey)
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        const template = TEMPLATES[templateName]
        if (!template) return Response.json({ error: 'Unknown template' }, { status: 404 })
        if (!template.to) return Response.json({ error: 'Template has no fixed recipient' }, { status: 400 })

        const supabase = createClient(supabaseUrl, serviceKey)
        const messageId = crypto.randomUUID()
        const idem = idempotencyKey || messageId
        const recipient = template.to
        const normalizedEmail = recipient.toLowerCase()

        // Suppression check (fail-closed)
        const { data: suppressed, error: suppressionError } = await supabase
          .from('suppressed_emails')
          .select('id')
          .eq('email', normalizedEmail)
          .maybeSingle()
        if (suppressionError) {
          return Response.json({ error: 'Failed to verify suppression status' }, { status: 500 })
        }
        if (suppressed) {
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: templateName,
            recipient_email: recipient,
            status: 'suppressed',
          })
          return Response.json({ success: false, reason: 'email_suppressed' })
        }

        // Get or create unsubscribe token (one per email)
        let unsubscribeToken: string
        const { data: existingToken, error: tokenLookupError } = await supabase
          .from('email_unsubscribe_tokens')
          .select('token, used_at')
          .eq('email', normalizedEmail)
          .maybeSingle()
        if (tokenLookupError) {
          return Response.json({ error: 'Failed to prepare email' }, { status: 500 })
        }
        if (existingToken && !existingToken.used_at) {
          unsubscribeToken = existingToken.token
        } else if (!existingToken) {
          unsubscribeToken = generateToken()
          const { error: tokenError } = await supabase
            .from('email_unsubscribe_tokens')
            .upsert(
              { token: unsubscribeToken, email: normalizedEmail },
              { onConflict: 'email', ignoreDuplicates: true },
            )
          if (tokenError) {
            return Response.json({ error: 'Failed to prepare email' }, { status: 500 })
          }
          const { data: storedToken } = await supabase
            .from('email_unsubscribe_tokens')
            .select('token')
            .eq('email', normalizedEmail)
            .maybeSingle()
          if (!storedToken) {
            return Response.json({ error: 'Failed to prepare email' }, { status: 500 })
          }
          unsubscribeToken = storedToken.token
        } else {
          return Response.json({ success: false, reason: 'email_suppressed' })
        }

        const element = React.createElement(template.component, templateData)
        const html = await render(element)
        const text = await render(element, { plainText: true })
        const subject = typeof template.subject === 'function' ? template.subject(templateData) : template.subject

        await supabase.from('email_send_log').insert({
          message_id: messageId,
          template_name: templateName,
          recipient_email: recipient,
          status: 'pending',
        })

        const { error: enqueueError } = await supabase.rpc('enqueue_email', {
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
            label: templateName,
            idempotency_key: idem,
            unsubscribe_token: unsubscribeToken,
            queued_at: new Date().toISOString(),
          },
        })

        if (enqueueError) {
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: templateName,
            recipient_email: recipient,
            status: 'failed',
            error_message: enqueueError.message,
          })
          return Response.json({ error: 'Failed to enqueue' }, { status: 500 })
        }

        return Response.json({ success: true })
      },
    },
  },
})
