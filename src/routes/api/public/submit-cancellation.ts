import { TEMPLATES } from '@/lib/email-templates/registry'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const SITE_NAME = 'Sicher Schwimmen e.V.'

const submitSchema = z.object({
  parent_first_name: z.string().trim().min(1).max(100),
  parent_last_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(3).max(50),
  child_name: z.string().trim().min(1).max(150),
  course_name: z.string().trim().min(1).max(200),
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(2000).optional().or(z.literal('')).transform(v => (v ? v : null)),
  revocation_text: z.string().trim().min(5).max(2000),
  confirm: z.literal(true),
  // honeypot — must be empty
  website: z.string().max(0).optional(),
})

function todayYmd(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function randomDigits(n: number): string {
  const max = 10 ** n
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return String(buf[0] % max).padStart(n, '0')
}

function getClientIp(request: Request): string | null {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip')
}

async function enqueueTemplate(
  _supabase: any,
  templateName: string,
  recipient: string,
  templateData: Record<string, any>,
  idempotencyKey: string,
) {
  const { queueTemplateEmail } = await import('@/lib/email-send.server')
  const result = await queueTemplateEmail({
    templateName,
    recipientEmail: recipient,
    templateData,
    idempotencyKey,
  })
  if (!result.queued && result.reason !== 'suppressed') {
    throw new Error(result.reason || 'send_failed')
  }
  return { suppressed: !result.queued }
}

export const Route = createFileRoute('/api/public/submit-cancellation')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        let body: unknown
        try { body = await request.json() } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        const parsed = submitSchema.safeParse(body)
        if (!parsed.success) {
          return Response.json(
            { error: 'Bitte prüfen Sie Ihre Eingaben.', issues: parsed.error.flatten() },
            { status: 400 },
          )
        }
        const data = parsed.data

        if (data.website && data.website.length > 0) {
          // Silent honeypot reject — pretend success.
          return Response.json({ success: true, reference_number: 'SW-WID-00000000-00000' })
        }

        const supabase = createClient(supabaseUrl, serviceKey)
        const ip = getClientIp(request)
        const userAgent = request.headers.get('user-agent')?.slice(0, 500) || null

        // Simple DB-based rate limit: max 5 submissions per IP in last hour.
        if (ip) {
          const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
          const { count } = await supabase
            .from('cancellation_requests')
            .select('id', { count: 'exact', head: true })
            .eq('ip_address', ip)
            .gte('created_at', since)
          if ((count ?? 0) >= 5) {
            return Response.json(
              { error: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.' },
              { status: 429 },
            )
          }
        }

        // Generate reference + insert with retry on unique conflict
        let referenceNumber = ''
        let insertedId: string | null = null
        let inserted: any = null
        for (let attempt = 0; attempt < 5; attempt++) {
          referenceNumber = `SW-WID-${todayYmd()}-${randomDigits(5)}`
          const { data: row, error } = await supabase
            .from('cancellation_requests')
            .insert({
              reference_number: referenceNumber,
              parent_first_name: data.parent_first_name,
              parent_last_name: data.parent_last_name,
              email: data.email,
              phone: data.phone,
              child_name: data.child_name,
              course_name: data.course_name,
              booking_date: data.booking_date,
              notes: data.notes,
              revocation_text: data.revocation_text,
              ip_address: ip,
              user_agent: userAgent,
            })
            .select('id, created_at')
            .single()
          if (!error) {
            insertedId = row.id
            inserted = row
            break
          }
          // 23505 = unique_violation → retry with new reference
          if ((error as any).code !== '23505') {
            console.error('[cancellation] insert failed', error)
            return Response.json(
              { error: 'Konnte den Widerruf nicht speichern.' },
              { status: 500 },
            )
          }
        }
        if (!insertedId) {
          return Response.json(
            { error: 'Konnte keine eindeutige Referenznummer erzeugen.' },
            { status: 500 },
          )
        }

        // Enqueue emails — non-fatal on failure (record stays).
        const createdAt = inserted?.created_at || new Date().toISOString()
        try {
          await enqueueTemplate(
            supabase,
            'cancellation-internal',
            TEMPLATES['cancellation-internal'].to!,
            {
              reference_number: referenceNumber,
              parent_first_name: data.parent_first_name,
              parent_last_name: data.parent_last_name,
              email: data.email,
              phone: data.phone,
              child_name: data.child_name,
              course_name: data.course_name,
              booking_date: data.booking_date,
              notes: data.notes,
              revocation_text: data.revocation_text,
              ip_address: ip || undefined,
              created_at: createdAt,
            },
            `cancellation-internal-${referenceNumber}`,
          )
        } catch (e) {
          console.error('[cancellation] internal email enqueue failed', e)
        }

        try {
          await enqueueTemplate(
            supabase,
            'cancellation-confirmation',
            data.email,
            {
              reference_number: referenceNumber,
              parent_first_name: data.parent_first_name,
              parent_last_name: data.parent_last_name,
              child_name: data.child_name,
              course_name: data.course_name,
            },
            `cancellation-confirmation-${referenceNumber}`,
          )
        } catch (e) {
          console.error('[cancellation] confirmation email enqueue failed', e)
        }

        return Response.json({ success: true, reference_number: referenceNumber })
      },
    },
  },
})
