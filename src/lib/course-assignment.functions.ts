import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const SITE_NAME = 'sicher-schwimm-hub'
const SENDER_DOMAIN = 'notify.sicher-schwimmen.com'
const FROM_DOMAIN = 'notify.sicher-schwimmen.com'

export const assignRequestToCourse = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    requestId: string
    courseId: string
    status: 'confirmed' | 'waiting'
    sendEmail: boolean
    adminNotes?: string
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context

    // Authorize: staff only
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

    // Insert participant (ignore unique conflict)
    const { error: partErr } = await supabaseAdmin.from('course_participants').insert({
      course_id: course.id,
      participant_name: participantName,
      participant_email: req.parent_email,
      participant_phone: req.parent_phone,
      status: data.status,
      notes: req.health_info || null,
      request_id: req.id,
      date_of_birth: req.child_dob || null,
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
      }
      const element = React.createElement(tpl.component, templateData)
      const html = await render(element)
      const text = await render(element, { plainText: true })
      const subject = typeof tpl.subject === 'function' ? tpl.subject(templateData) : tpl.subject
      const messageId = crypto.randomUUID()

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
