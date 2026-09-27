import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { formatDateBerlin } from '@/lib/format'

function shiftIso(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.rpc('is_staff', { _user_id: userId })
  if (!data) throw new Error('Forbidden')
}

/** Verschiebt Kursstart + alle Kurstage und informiert gebuchte Eltern. */
export const rescheduleCourse = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    courseId: z.string().uuid(),
    newStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().max(2000).optional(),
    notify: z.boolean(),
    keepTentative: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: course } = await supabaseAdmin.from('courses').select('*').eq('id', data.courseId).maybeSingle()
    if (!course) throw new Error('Kurs nicht gefunden')
    if (!course.starts_on) throw new Error('Kurs hat noch kein Startdatum – bitte über „Bearbeiten“ eintragen.')

    const delta = Math.round((Date.parse(data.newStart) - Date.parse(course.starts_on)) / 86400000)
    const newEnd = course.ends_on ? shiftIso(course.ends_on, delta) : null

    if (delta !== 0) {
      const { data: sessions } = await supabaseAdmin.from('course_sessions').select('id,session_date').eq('course_id', course.id)
      for (const s of sessions ?? []) {
        await supabaseAdmin.from('course_sessions').update({ session_date: shiftIso(s.session_date, delta) }).eq('id', s.id)
      }
    }
    const { error } = await supabaseAdmin.from('courses').update({
      starts_on: data.newStart, ends_on: newEnd, start_tentative: data.keepTentative,
    } as never).eq('id', course.id)
    if (error) throw new Error(error.message)

    let sent = 0
    if (data.notify) {
      const { queueTemplateEmail } = await import('@/lib/email-send.server')
      const { data: parts } = await supabaseAdmin.from('course_participants')
        .select('id,participant_name,participant_email').eq('course_id', course.id).eq('status', 'confirmed')
      for (const p of parts ?? []) {
        if (!p.participant_email) continue
        const r = await queueTemplateEmail({
          templateName: 'course-rescheduled',
          recipientEmail: p.participant_email,
          senderUserId: context.userId,
          idempotencyKey: `course-rescheduled-${course.id}-${p.id}-${data.newStart}`,
          templateData: {
            child_name: p.participant_name, course_name: course.name,
            old_start: formatDateBerlin(course.starts_on), new_start: formatDateBerlin(data.newStart),
            new_end: newEnd ? formatDateBerlin(newEnd) : null, reason: data.note || null,
          },
        })
        if (r.queued) sent++
      }
    }
    const { logAudit } = await import('@/lib/audit.server')
    await logAudit(null, context.userId, { action: 'course.rescheduled', entity: 'courses', entity_id: course.id, metadata: { from: course.starts_on, to: data.newStart, sent } })
    return { ok: true, sent, delta }
  })

/** Sagt einen Kurs ab: Eltern informieren, Kinder mit Original-Datum zurück auf die Warteliste. */
export const cancelCourse = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    courseId: z.string().uuid(),
    reason: z.string().max(2000).optional(),
    notify: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: course } = await supabaseAdmin.from('courses').select('*').eq('id', data.courseId).maybeSingle()
    if (!course) throw new Error('Kurs nicht gefunden')

    const { data: parts } = await supabaseAdmin.from('course_participants').select('*')
      .eq('course_id', course.id).neq('status', 'cancelled')
    const { queueTemplateEmail } = await import('@/lib/email-send.server')
    let moved = 0, sent = 0

    for (const p of parts ?? []) {
      const email = (p.participant_email ?? '').trim()
      const req = p.request_id
        ? (await supabaseAdmin.from('course_requests').select('*').eq('id', p.request_id).maybeSingle()).data
        : null
      // Vorhandenen Wartelisten-Eintrag suchen (Original-Anmeldedatum bleibt erhalten)
      let entry: { id: string; admin_notes: string | null } | null = null
      {
        const q = supabaseAdmin.from('waitlist_entries').select('id,admin_notes,created_at')
        const { data: found } = await (p.request_id
          ? q.or(`request_id.eq.${p.request_id},offer_course_id.eq.${course.id}`)
          : q.eq('offer_course_id', course.id))
        const match = (found ?? []).find(() => true) ?? null
        if (!match && email) {
          const { data: byMail } = await supabaseAdmin.from('waitlist_entries').select('id,admin_notes,child_name')
            .ilike('parent_email', email)
          entry = (byMail ?? []).find(e => (e.child_name ?? '').toLowerCase().trim() === (p.participant_name ?? '').toLowerCase().trim()) ?? null
        } else entry = match
      }
      const note = `Kurs „${course.name}“ abgesagt – zurück auf die Warteliste.`
      if (entry) {
        await supabaseAdmin.from('waitlist_entries').update({
          status: 'waiting', offer_course_id: null, offer_token: null, offered_at: null, offer_expires_at: null,
          admin_notes: [entry.admin_notes, note].filter(Boolean).join('\n'),
        } as never).eq('id', entry.id)
      } else {
        await supabaseAdmin.from('waitlist_entries').insert({
          program_id: course.program_id ?? null,
          request_id: req?.id ?? null,
          child_name: p.participant_name ?? 'Unbekannt',
          child_dob: p.date_of_birth ?? req?.child_dob ?? null,
          parent_name: req?.parent_name ?? p.participant_name ?? 'Unbekannt',
          parent_email: email,
          parent_phone: p.participant_phone ?? null,
          parent_user_id: p.parent_user_id ?? null,
          is_member: p.is_member ?? null,
          notes: p.notes ?? null,
          admin_notes: note,
          gdpr_consent: true,
          status: 'waiting',
          // Original-Datum: Anfrage bzw. Buchung
          created_at: req?.created_at ?? p.created_at,
        } as never)
      }
      await supabaseAdmin.from('course_participants').update({ status: 'cancelled' }).eq('id', p.id)
      if (req?.id) await supabaseAdmin.from('course_requests').update({ assigned_course_id: null, status: 'waiting_list' }).eq('id', req.id)
      moved++

      if (data.notify && email) {
        const r = await queueTemplateEmail({
          templateName: 'course-cancelled',
          recipientEmail: email,
          senderUserId: context.userId,
          idempotencyKey: `course-cancelled-${course.id}-${p.id}`,
          templateData: {
            parent_name: req?.parent_name ?? null, child_name: p.participant_name, course_name: course.name,
            old_start: course.starts_on ? formatDateBerlin(course.starts_on) : null,
            reason: data.reason || null, paid: !!p.paid,
          },
        })
        if (r.queued) sent++
      }
    }

    await supabaseAdmin.from('courses').update({ is_public: false, status: 'completed', archived_at: new Date().toISOString() }).eq('id', course.id)
    const { logAudit } = await import('@/lib/audit.server')
    await logAudit(null, context.userId, { action: 'course.cancelled', entity: 'courses', entity_id: course.id, metadata: { moved, sent, reason: data.reason ?? null } })
    const paidCount = (parts ?? []).filter(p => p.paid).length
    return { ok: true, moved, sent, paidCount }
  })

/** Eilnachricht (z. B. Ausfall, Badschließung) an alle gebuchten Eltern eines Kurses. */
export const broadcastCourseMessage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    courseId: z.string().uuid(),
    subject: z.string().trim().min(3).max(200),
    message: z.string().trim().min(5).max(4000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: course } = await supabaseAdmin.from('courses').select('id,name').eq('id', data.courseId).maybeSingle()
    if (!course) throw new Error('Kurs nicht gefunden')
    const { queueTemplateEmail } = await import('@/lib/email-send.server')
    const { data: parts } = await supabaseAdmin.from('course_participants')
      .select('id,participant_name,participant_email').eq('course_id', course.id).eq('status', 'confirmed')
    const stamp = Date.now()
    const seen = new Set<string>()
    let sent = 0
    for (const p of parts ?? []) {
      const email = p.participant_email?.trim().toLowerCase()
      if (!email || seen.has(email)) continue
      seen.add(email)
      const kids = (parts ?? []).filter((x) => x.participant_email?.trim().toLowerCase() === email).map((x) => x.participant_name).filter(Boolean).join(' und ')
      const r = await queueTemplateEmail({
        templateName: 'course-broadcast',
        recipientEmail: p.participant_email!,
        senderUserId: context.userId,
        idempotencyKey: `course-broadcast-${course.id}-${p.id}-${stamp}`,
        templateData: { subject: data.subject, message: data.message, course_name: course.name, child_name: kids || null },
      })
      if (r.queued) sent++
    }
    const { logAudit } = await import('@/lib/audit.server')
    await logAudit(null, context.userId, { action: 'course.broadcast', entity: 'courses', entity_id: course.id, metadata: { subject: data.subject, sent } })
    return { sent, total: seen.size }
  })
