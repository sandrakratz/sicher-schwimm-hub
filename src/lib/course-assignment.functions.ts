import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { BILLING } from '@/lib/billing-config'

const SITE_NAME = 'sicher-schwimm-hub'
const SENDER_DOMAIN = 'notify.sicher-schwimmen.com'
const FROM_DOMAIN = 'notify.sicher-schwimmen.com'
const SITE_BASE_URL = 'https://sicher-schwimmen.com'

/**
 * Schlägt Mitgliedstatus und Eltern-Konto basierend auf einer E-Mail vor.
 * Wird vom Admin-Dialog "Einbuchen" verwendet, um Vorbelegungen zu liefern.
 */
export const suggestMatchForRequest = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => input)
  .handler(async ({ data, context }) => {
    const { userId } = context
    const { data: isStaff } = await context.supabase.rpc('is_staff', { _user_id: userId })
    if (!isStaff) throw new Error('Forbidden')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const email = (data.email || '').trim().toLowerCase()
    if (!email) return { isMember: null, parentUserId: null, parentLabel: null }

    const [memRes, profRes] = await Promise.all([
      supabaseAdmin.from('memberships').select('id,status').ilike('email', email).limit(1).maybeSingle(),
      supabaseAdmin.from('profiles').select('id,email,first_name,last_name').ilike('email', email).limit(1).maybeSingle(),
    ])

    const isMember = memRes.data ? memRes.data.status === 'active' : null
    const parentUserId = profRes.data?.id ?? null
    const parentLabel = profRes.data
      ? [profRes.data.first_name, profRes.data.last_name].filter(Boolean).join(' ') || profRes.data.email
      : null

    return { isMember, parentUserId, parentLabel }
  })

export const assignRequestToCourse = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    requestId: string
    courseId: string
    status: 'confirmed' | 'waiting'
    sendEmail: boolean
    adminNotes?: string
    isMember?: boolean | null
    parentUserId?: string | null
    priceAmount?: number | null
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context

    const { data: isStaff } = await supabase.rpc('is_staff', { _user_id: userId })
    if (!isStaff) throw new Error('Forbidden')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const { data: req, error: reqErr } = await supabaseAdmin
      .from('course_requests').select('*').eq('id', data.requestId).maybeSingle()
    if (reqErr || !req) throw new Error('Anfrage nicht gefunden')

    const { data: course, error: courseErr } = await supabaseAdmin
      .from('courses').select('*').eq('id', data.courseId).maybeSingle()
    if (courseErr || !course) throw new Error('Kurs nicht gefunden')

    const participantName = req.child_name || req.parent_name

    // Wenn kein parent_user_id übergeben wurde: per E-Mail-Match nachschlagen
    let parentUserId = data.parentUserId ?? null
    if (!parentUserId && req.parent_email) {
      const { data: prof } = await supabaseAdmin
        .from('profiles').select('id').ilike('email', req.parent_email).limit(1).maybeSingle()
      parentUserId = prof?.id ?? null
    }

    // Wenn kein isMember übergeben: per E-Mail-Match in memberships
    let isMember: boolean | null = data.isMember ?? null
    if (isMember == null && req.parent_email) {
      const { data: mem } = await supabaseAdmin
        .from('memberships').select('status').ilike('email', req.parent_email).limit(1).maybeSingle()
      if (mem) isMember = mem.status === 'active'
    }

    // Preis bestimmen: explizit übergebener Preis ODER aus Kurs ableiten
    let priceAmount: number | null = data.priceAmount ?? null
    if (priceAmount == null) {
      if (isMember === true && course.price_member != null) priceAmount = Number(course.price_member)
      else if (isMember === false && course.price_non_member != null) priceAmount = Number(course.price_non_member)
    }

    // Insert participant
    const { error: partErr } = await supabaseAdmin.from('course_participants').insert({
      course_id: course.id,
      participant_name: participantName,
      participant_email: req.parent_email,
      participant_phone: req.parent_phone,
      status: data.status,
      notes: req.health_info || null,
      request_id: req.id,
      date_of_birth: req.child_dob || null,
      parent_user_id: parentUserId,
      is_member: isMember,
      price_amount: priceAmount,
    })

    if (partErr && !String(partErr.message).toLowerCase().includes('duplicate')) {
      throw new Error(partErr.message)
    }

    // Update request
    await supabaseAdmin.from('course_requests').update({
      status: data.status === 'waiting' ? 'waiting_list' : 'accepted',
      assigned_course_id: course.id,
      admin_notes: data.adminNotes ?? req.admin_notes,
    }).eq('id', req.id)

    let emailQueued = false
    if (data.sendEmail && req.parent_email) {
      const { render } = await import('@react-email/components')
      const React = await import('react')
      const { TEMPLATES } = await import('@/lib/email-templates/registry')
      const tpl = TEMPLATES['course-assignment']
      const statusLabel = data.status === 'waiting' ? 'Warteliste' : 'Bestätigt'
      const childPart = req.child_name || req.parent_name || ''
      const templateData = {
        parent_name: req.parent_name,
        child_name: req.child_name,
        course_name: course.name,
        course_target_group: course.target_group,
        course_age_range: course.age_range,
        course_duration: course.duration,
        course_location: course.location,
        course_schedule: course.schedule,
        course_starts_on: course.starts_on,
        course_ends_on: course.ends_on,
        course_description: course.description,
        status_label: statusLabel,
        admin_notes: data.adminNotes || null,
        is_member: isMember,
        price_amount: priceAmount,
        payment_due_days: course.payment_due_days ?? 14,
        bank_recipient: BILLING.recipient,
        bank_iban: BILLING.iban,
        bank_bic: BILLING.bic,
        bank_name: BILLING.bankName,
        payment_reference: `${course.name}${childPart ? ' – ' + childPart : ''}`,
        site_base_url: SITE_BASE_URL,
      }
      const element = React.createElement(tpl.component, templateData)
      const html = await render(element)
      const text = await render(element, { plainText: true })
      const subject = typeof tpl.subject === 'function' ? tpl.subject(templateData) : tpl.subject
      const messageId = crypto.randomUUID()

      const normalizedEmail = req.parent_email.toLowerCase()
      let unsubscribeToken: string
      const { data: existingToken } = await supabaseAdmin
        .from('email_unsubscribe_tokens')
        .select('token, used_at')
        .eq('email', normalizedEmail)
        .maybeSingle()
      if (existingToken && !existingToken.used_at) {
        unsubscribeToken = existingToken.token
      } else {
        unsubscribeToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
        await supabaseAdmin.from('email_unsubscribe_tokens').upsert(
          { token: unsubscribeToken, email: normalizedEmail },
          { onConflict: 'email', ignoreDuplicates: true }
        )
        const { data: stored } = await supabaseAdmin
          .from('email_unsubscribe_tokens')
          .select('token')
          .eq('email', normalizedEmail)
          .maybeSingle()
        if (stored?.token) unsubscribeToken = stored.token
      }

      await supabaseAdmin.from('email_send_log').insert({
        message_id: messageId,
        template_name: 'course-assignment',
        recipient_email: req.parent_email,
        status: 'pending',
      })

      const { error: enqErr } = await supabaseAdmin.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload: {
          message_id: messageId,
          to: req.parent_email,
          from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject,
          html,
          text,
          purpose: 'transactional',
          label: 'course-assignment',
          idempotency_key: `course-assign-${req.id}-${course.id}-${Date.now()}`,
          unsubscribe_token: unsubscribeToken,
          queued_at: new Date().toISOString(),
        },
      })

      if (enqErr) {
        await supabaseAdmin.from('email_send_log').insert({
          message_id: messageId,
          template_name: 'course-assignment',
          recipient_email: req.parent_email,
          status: 'failed',
          error_message: enqErr.message,
        })
      } else {
        emailQueued = true
      }
    }

    return { ok: true, emailQueued }
  })
