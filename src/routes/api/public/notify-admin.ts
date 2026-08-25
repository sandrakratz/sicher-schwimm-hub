import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { TEMPLATES } from '@/lib/email-templates/registry'

// Bounded string helper to prevent oversized payloads / abuse.
const s = (max = 500) => z.string().trim().max(max).optional()

// Per-template schemas. Only templates listed here can be triggered via this
// unauthenticated endpoint, and only the fields below are forwarded to the
// email template. Unknown fields are stripped.
const TEMPLATE_DATA_SCHEMAS: Record<string, z.ZodTypeAny> = {
  'contact-message': z.object({
    from_name: s(200),
    from_email: s(320),
    category: s(100),
    subject: s(300),
    body: s(5000),
    created_at: s(50),
  }).strip(),
  'course-request': z.object({
    parent_name: s(200),
    parent_email: s(320),
    parent_phone: s(50),
    child_name: s(200),
    child_dob: s(50),
    swimming_level: s(200),
    desired_course: s(200),
    health_info: s(2000),
    message: s(5000),
    created_at: s(50),
  }).strip(),
  'membership-application': z.object({
    full_name: s(200),
    email: s(320),
    membership_type: s(100),
    phone: s(50),
    city: s(200),
    iban: s(50),
    created_at: s(50),
  }).strip(),
  'new-registration': z.object({
    first_name: s(200),
    last_name: s(200),
    email: s(320),
    created_at: s(50),
  }).strip(),
}

// Public endpoint that sends a notification email to the fixed admin recipient
// defined in the template (`template.to`). Only templates that declare a
// fixed `to` address are accepted, so this endpoint cannot be abused to send
// mail to arbitrary recipients.
export const Route = createFileRoute('/api/public/notify-admin')({
  server: {
    handlers: {
      POST: async ({ request }) => {
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

        const schema = TEMPLATE_DATA_SCHEMAS[templateName]
        if (!schema) return Response.json({ error: 'Template not permitted via this endpoint' }, { status: 403 })
        const parsed = schema.safeParse(templateData)
        if (!parsed.success) {
          return Response.json({ error: 'Invalid templateData' }, { status: 400 })
        }
        templateData = parsed.data as Record<string, any>

        const { queueTemplateEmail } = await import('@/lib/email-send.server')
        const result = await queueTemplateEmail({
          templateName,
          templateData,
          idempotencyKey: idempotencyKey || crypto.randomUUID(),
        })

        if (!result.queued) {
          if (result.reason === 'suppressed') {
            return Response.json({ success: false, reason: 'email_suppressed' })
          }
          return Response.json({ error: 'Failed to send' }, { status: 500 })
        }

        return Response.json({ success: true })
      },
    },
  },
})

