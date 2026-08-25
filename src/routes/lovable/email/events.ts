import { createEmailWebhookHandler } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'

type Reason = 'bounce' | 'complaint' | 'unsubscribe'

const STATUS: Record<Reason, string> = {
  bounce: 'bounced',
  complaint: 'complained',
  unsubscribe: 'suppressed',
}

const MESSAGE: Record<Reason, string> = {
  bounce: 'Empfänger wurde wegen einer Zustellungs-Rückläufer (Bounce) gesperrt.',
  complaint: 'Empfänger wurde wegen einer Spam-Beschwerde gesperrt.',
  unsubscribe: 'Empfänger hat sich von E-Mails abgemeldet.',
}

async function record(reason: Reason, recipient: string, eventId: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const email = recipient.toLowerCase()

  const { error: suppressError } = await supabaseAdmin
    .from('suppressed_emails')
    .upsert({ email, reason, metadata: null }, { onConflict: 'email' })
  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      code: suppressError.code,
      message: suppressError.message,
      event_id: eventId,
    })
    throw new Error('suppression_write_failed')
  }

  const { error: logError } = await supabaseAdmin.from('email_send_log').insert({
    message_id: null,
    template_name: 'system',
    recipient_email: email,
    status: STATUS[reason],
    error_message: MESSAGE[reason],
    metadata: null,
  })
  if (logError) {
    console.error('Failed to insert email_send_log', {
      code: logError.code,
      message: logError.message,
      event_id: eventId,
    })
    throw new Error('log_write_failed')
  }
}

export const Route = createFileRoute('/lovable/email/events')({
  server: {
    handlers: {
      POST: ({ request }) => {
        const apiKey = process.env['LOVABLE_API_KEY']
        if (!apiKey) {
          console.error('Missing required environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }
        const handler = createEmailWebhookHandler({
          apiKey,
          on: {
            'email.bounced': async (event) => {
              await record('bounce', event.data.recipient, event.event_id)
            },
            'email.complaint': async (event) => {
              await record('complaint', event.data.recipient, event.event_id)
            },
            'email.unsubscribed': async (event) => {
              await record('unsubscribe', event.data.recipient, event.event_id)
            },
          },
        })
        return handler(request)
      },
    },
  },
})
