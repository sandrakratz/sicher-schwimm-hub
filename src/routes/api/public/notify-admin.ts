import * as React from 'react'
import { render } from '@react-email/components'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'sicher-schwimm-hub'
const SENDER_DOMAIN = 'notify.sicher-schwimmen.com'
const FROM_DOMAIN = 'notify.sicher-schwimmen.com'

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
