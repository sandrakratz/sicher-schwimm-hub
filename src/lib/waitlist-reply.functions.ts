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

export const replyToWaitlistEntry = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { entryId: string; body: string; subject?: string }) => {
    if (!input.entryId) throw new Error('entryId erforderlich')
    const body = (input.body || '').trim()
    if (body.length < 2) throw new Error('Nachricht zu kurz')
    if (body.length > 10000) throw new Error('Nachricht zu lang')
    return { entryId: input.entryId, body, subject: (input.subject || '').trim().slice(0, 300) }
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    const { data: isStaff } = await supabase.rpc('is_staff', { _user_id: userId })
    if (!isStaff) throw new Error('Forbidden')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const { data: entry, error } = await supabaseAdmin
      .from('waitlist_entries')
      .select('id, child_name, child_dob, parent_name, parent_email, notes, admin_notes')
      .eq('id', data.entryId)
      .maybeSingle()
    if (error || !entry) throw new Error('Wartelisteneintrag nicht gefunden')
    if (!entry.parent_email) throw new Error('Keine E-Mail hinterlegt')

    const recipient = entry.parent_email as string
    const subject =
      data.subject ||
      `Rückfrage zu Ihrem Wartelisten-Eintrag${entry.child_name ? ` – ${entry.child_name}` : ''}`

    const escapedBody = escapeHtml(data.body).replace(/\n/g, '<br />')
    const summaryRows: [string, string | null][] = [
      ['Kind', entry.child_name],
      ['Geburtsdatum', entry.child_dob],
      ['Angaben aus dem Formular', entry.notes],
    ]
    const summaryHtml = summaryRows
      .filter(([, v]) => v && String(v).trim().length > 0)
      .map(([k, v]) => `<div style="margin-top:6px;"><em>${escapeHtml(k)}:</em> ${escapeHtml(String(v))}</div>`)
      .join('')

    const html = `<!doctype html><html lang="de"><body style="font-family:Arial,sans-serif;color:#0f172a;background:#fff;padding:24px;">
<div style="max-width:600px;margin:0 auto;">
  <p>Hallo ${escapeHtml(entry.parent_name || '')},</p>
  <p>${escapedBody}</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
  <p style="font-size:12px;color:#64748b;">Mit freundlichen Grüßen<br />${SITE_NAME}</p>
  <div style="margin-top:24px;padding:12px;background:#f1f5f9;border-radius:6px;font-size:12px;color:#475569;">
    <div style="font-weight:600;margin-bottom:6px;">Ihr Wartelisten-Eintrag:</div>
    ${summaryHtml || '<div>—</div>'}
  </div>
</div></body></html>`

    const summaryText = summaryRows
      .filter(([, v]) => v && String(v).trim().length > 0)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n')
    const text = `Hallo ${entry.parent_name || ''},\n\n${data.body}\n\n--\n${SITE_NAME}\n\n--- Ihr Wartelisten-Eintrag ---\n${summaryText}`

    const { sendRawEmail } = await import('@/lib/email-send.server')
    const result = await sendRawEmail({
      templateName: 'waitlist-reply',
      recipientEmail: recipient,
      subject,
      html,
      text,
      replyTo: REPLY_TO,
      senderUserId: userId,
      idempotencyKey: `waitlist-reply-${data.entryId}-${Date.now()}`,
    })
    if (!result.sent) {
      throw new Error(
        result.reason === 'suppressed'
          ? 'Empfänger hat sich abgemeldet'
          : 'E-Mail konnte nicht versendet werden',
      )
    }

    const stamp = new Date().toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })
    const noteLine = `[${stamp}] Rückfrage per E-Mail gesendet: ${subject}`
    await supabaseAdmin
      .from('waitlist_entries')
      .update({ admin_notes: entry.admin_notes ? `${entry.admin_notes}\n${noteLine}` : noteLine })
      .eq('id', data.entryId)

    const { logAudit } = await import('@/lib/audit.server')
    await logAudit(supabase, userId, {
      action: 'waitlist.replied',
      entity: 'waitlist_entries',
      entity_id: data.entryId,
      metadata: { recipient },
    })

    return { ok: true }
  })
