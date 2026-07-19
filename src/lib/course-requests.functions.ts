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

export const replyToCourseRequest = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string; body: string; subject?: string }) => {
    if (!input.requestId) throw new Error('requestId erforderlich')
    const body = (input.body || '').trim()
    if (body.length < 2) throw new Error('Nachricht zu kurz')
    if (body.length > 10000) throw new Error('Nachricht zu lang')
    return { requestId: input.requestId, body, subject: (input.subject || '').trim().slice(0, 300) }
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    const { data: isStaff } = await supabase.rpc('is_staff', { _user_id: userId })
    if (!isStaff) throw new Error('Forbidden')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const { data: req, error: reqErr } = await supabaseAdmin
      .from('course_requests').select('*').eq('id', data.requestId).maybeSingle()
    if (reqErr || !req) throw new Error('Anfrage nicht gefunden')
    if (!req.parent_email) throw new Error('Keine E-Mail hinterlegt')

    const recipient = req.parent_email as string
    const normalizedEmail = recipient.toLowerCase()

    const { data: suppressed } = await supabaseAdmin
      .from('suppressed_emails').select('id').eq('email', normalizedEmail).maybeSingle()
    if (suppressed) throw new Error('Empfänger hat sich abgemeldet')

    const subject = data.subject || `Rückfrage zu Ihrer Kursanfrage${req.child_name ? ` – ${req.child_name}` : ''}`
    const escapedBody = escapeHtml(data.body).replace(/\n/g, '<br />')

    const summaryRows: [string, string | null][] = [
      ['Kind', req.child_name],
      ['Geburtsdatum', req.child_dob],
      ['Schwimmlevel', req.swimming_level],
      ['Gewünschter Kurs', req.desired_course],
      ['Gesundheitshinweise', req.health_info],
      ['Ihre Nachricht', req.message],
    ]
    const summaryHtml = summaryRows
      .filter(([, v]) => v && String(v).trim().length > 0)
      .map(([k, v]) => `<div style="margin-top:6px;"><em>${escapeHtml(k)}:</em> ${escapeHtml(String(v))}</div>`)
      .join('')

    const html = `<!doctype html><html lang="de"><body style="font-family:Arial,sans-serif;color:#0f172a;background:#fff;padding:24px;">
<div style="max-width:600px;margin:0 auto;">
  <p>Hallo ${escapeHtml(req.parent_name || '')},</p>
  <p>${escapedBody}</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
  <p style="font-size:12px;color:#64748b;">Mit freundlichen Grüßen<br />${SITE_NAME}</p>
  <div style="margin-top:24px;padding:12px;background:#f1f5f9;border-radius:6px;font-size:12px;color:#475569;">
    <div style="font-weight:600;margin-bottom:6px;">Ihre ursprüngliche Kursanfrage:</div>
    ${summaryHtml || '<div>—</div>'}
  </div>
</div></body></html>`

    const summaryText = summaryRows
      .filter(([, v]) => v && String(v).trim().length > 0)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n')
    const text = `Hallo ${req.parent_name || ''},\n\n${data.body}\n\n--\n${SITE_NAME}\n\n--- Ihre ursprüngliche Kursanfrage ---\n${summaryText}`

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
      template_name: 'course-request-reply',
      recipient_email: recipient,
      status: 'pending',
      subject,
      body_text: text,
      body_html: html,
      sender_user_id: userId,
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
        label: 'course-request-reply',
        idempotency_key: `course-request-reply-${data.requestId}-${Date.now()}`,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    })

    if (enqErr) {
      await supabaseAdmin.from('email_send_log').insert({
        message_id: messageId,
        template_name: 'course-request-reply',
        recipient_email: recipient,
        status: 'failed',
        error_message: enqErr.message,
      })
      throw new Error(enqErr.message)
    }

    await supabaseAdmin.from('course_requests').update({ status: 'contacted' }).eq('id', data.requestId)

    const { logAudit } = await import('@/lib/audit.server')
    await logAudit(supabase, userId, {
      action: 'course_request.replied',
      entity: 'course_requests',
      entity_id: data.requestId,
      metadata: { recipient },
    })

    return { ok: true }
  })
