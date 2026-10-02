// Versendet einmalig pro E-Mail-Adresse die „Konto freigeschaltet“-Mail.
import { escapeLike } from '@/lib/like'
const TYPE_LABEL: Record<string, string> = {
  children_youth: 'Kinder & Jugend',
  adult: 'Erwachsene',
  family: 'Familie',
  supporting: 'Förderung',
}

export async function sendAccountActivatedEmail(opts: {
  email: string
  firstName?: string | null
  membershipType?: string | null
  senderUserId?: string | null
}): Promise<{ sent: boolean; reason?: string }> {
  const email = opts.email.trim().toLowerCase()
  if (!email) return { sent: false, reason: 'no_recipient' }
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

  const { data: existing } = await supabaseAdmin
    .from('email_send_log')
    .select('id')
    .eq('template_name', 'account-activated')
    .ilike('recipient_email', escapeLike(email))
    .eq('status', 'sent')
    .limit(1)
  if (existing && existing.length) return { sent: false, reason: 'already_sent' }

  let membershipType = opts.membershipType ?? null
  let firstName = opts.firstName ?? null
  if (!membershipType || !firstName) {
    const { data: m } = await supabaseAdmin
      .from('memberships')
      .select('membership_type, first_name')
      .ilike('email', escapeLike(email))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    membershipType = membershipType ?? m?.membership_type ?? null
    firstName = firstName ?? m?.first_name ?? null
  }

  const { queueTemplateEmail } = await import('@/lib/email-send.server')
  const r = await queueTemplateEmail({
    templateName: 'account-activated',
    recipientEmail: email,
    templateData: {
      first_name: firstName ?? undefined,
      membership_label: membershipType ? TYPE_LABEL[membershipType] ?? undefined : undefined,
      login_url: 'https://sicher-schwimmen.com/auth',
    },
    idempotencyKey: `account-activated-${email}`,
    senderUserId: opts.senderUserId ?? null,
  })
  return { sent: r.queued, reason: r.reason }
}
