import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { formatDateBerlin } from '@/lib/format'

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.rpc('is_staff', { _user_id: userId })
  if (!data) throw new Error('Forbidden')
}

function todayBerlin() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
}
const round2 = (n: number) => Math.round(n * 100) / 100

export type TransferPreview = {
  oldCourse: string
  oldPrice: number
  oldPaid: boolean
  oldTotal: number
  oldUsed: number
  newCourse: string
  newPrice: number
  newTotal: number
  newRemaining: number
  isMember: boolean | null
}

async function loadCourseInfo(admin: any, courseId: string) {
  const { data: course } = await admin.from('courses').select('*').eq('id', courseId).maybeSingle()
  if (!course) throw new Error('Kurs nicht gefunden')
  const { data: sessions } = await admin.from('course_sessions')
    .select('session_date,start_time,end_time,session_index').eq('course_id', courseId).order('session_date')
  return { course, sessions: (sessions ?? []) as Array<{ session_date: string; start_time: string | null; end_time: string | null }> }
}

/** Berechnungsgrundlage für eine Umbuchung (Vorschlag, im Dialog änderbar). */
export const previewTransfer = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ participantId: z.string().uuid(), targetCourseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<TransferPreview> => {
    await assertStaff(context.supabase, context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: p } = await supabaseAdmin.from('course_participants').select('*').eq('id', data.participantId).maybeSingle()
    if (!p) throw new Error('Teilnehmer nicht gefunden')
    const today = todayBerlin()
    const oldI = await loadCourseInfo(supabaseAdmin, p.course_id)
    const newI = await loadCourseInfo(supabaseAdmin, data.targetCourseId)
    const oldTotal = oldI.sessions.length || oldI.course.unit_count || 1
    const oldUsed = oldI.sessions.length ? oldI.sessions.filter(s => s.session_date < today).length : 0
    const newTotal = newI.sessions.length || newI.course.unit_count || 1
    const newRemaining = newI.sessions.length ? newI.sessions.filter(s => s.session_date >= today).length : newTotal
    const member = p.is_member === true
    const newPrice = Number((member ? newI.course.price_member : newI.course.price_non_member) ?? newI.course.price_non_member ?? 0)
    return {
      oldCourse: oldI.course.name, oldPrice: Number(p.price_amount ?? 0), oldPaid: !!p.paid,
      oldTotal, oldUsed, newCourse: newI.course.name, newPrice, newTotal, newRemaining, isMember: p.is_member,
    }
  })

/** Bucht ein Kind in einen anderen Kurs um und verrechnet die Stunden. */
export const transferParticipant = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    participantId: z.string().uuid(),
    targetCourseId: z.string().uuid(),
    reason: z.string().trim().min(3).max(2000),
    amountDue: z.number().min(-10000).max(10000),
    calcNote: z.string().max(1000),
    notify: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: p } = await supabaseAdmin.from('course_participants').select('*').eq('id', data.participantId).maybeSingle()
    if (!p) throw new Error('Teilnehmer nicht gefunden')
    if (p.status === 'cancelled') throw new Error('Diese Buchung ist bereits beendet.')
    if (p.course_id === data.targetCourseId) throw new Error('Das Kind ist bereits in diesem Kurs.')
    const oldI = await loadCourseInfo(supabaseAdmin, p.course_id)
    const newI = await loadCourseInfo(supabaseAdmin, data.targetCourseId)
    const { freeSlots } = await import('@/lib/waitlist.server')
    const free = await freeSlots(newI.course.id, newI.course.max_participants)
    if (free != null && free <= 0) throw new Error('Im Zielkurs ist kein Platz mehr frei.')

    const due = round2(data.amountDue)
    const now = new Date().toISOString()
    const today = todayBerlin()
    const dueDate = due > 0
      ? (() => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + (newI.course.payment_due_days || 14)); return d.toISOString().slice(0, 10) })()
      : null
    const line = `Umbuchung ${formatDateBerlin(today)}: „${oldI.course.name}“ → „${newI.course.name}“. Grund: ${data.reason}. ${data.calcNote}`

    const { data: inserted, error: insErr } = await supabaseAdmin.from('course_participants').insert({
      course_id: newI.course.id,
      user_id: p.user_id, parent_user_id: p.parent_user_id, request_id: p.request_id,
      participant_name: p.participant_name, participant_email: p.participant_email, participant_phone: p.participant_phone,
      date_of_birth: p.date_of_birth, notes: p.notes,
      internal_notes: [p.internal_notes, line].filter(Boolean).join('\n'),
      status: 'confirmed', is_member: p.is_member, member_confirmed: p.member_confirmed,
      member_confirmed_at: p.member_confirmed_at, member_confirmed_by: p.member_confirmed_by,
      payer_street: p.payer_street, payer_zip: p.payer_zip, payer_city: p.payer_city,
      online_booking: p.online_booking, payment_method: p.payment_method,
      price_amount: Math.max(due, 0),
      paid: due <= 0, paid_at: due <= 0 ? now : null, paid_by: due <= 0 ? context.userId : null,
      payment_note: due > 0 ? `Restbetrag aus Umbuchung (${data.calcNote})` : `Durch Umbuchung verrechnet (${data.calcNote})`,
      payment_due_date: dueDate,
      exam_level: p.exam_level, exam_criteria: p.exam_criteria, exam_date: p.exam_date, exam_pass_no: p.exam_pass_no,
      transferred_from_participant_id: p.id, transfer_reason: data.reason, transferred_at: now,
    } as never).select('id').single()
    if (insErr) throw new Error(insErr.message)

    const { error: upErr } = await supabaseAdmin.from('course_participants').update({
      status: 'cancelled', transferred_to_course_id: newI.course.id, transfer_reason: data.reason, transferred_at: now,
      internal_notes: [p.internal_notes, line].filter(Boolean).join('\n'),
    } as never).eq('id', p.id)
    if (upErr) throw new Error(upErr.message)

    let emailed = false
    if (data.notify && p.participant_email) {
      const { queueTemplateEmail } = await import('@/lib/email-send.server')
      const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`
      const sessions = newI.sessions.filter(s => s.session_date >= today).map(s =>
        `${formatDateBerlin(s.session_date)}${s.start_time ? ` · ${s.start_time.slice(0, 5)}${s.end_time ? `–${s.end_time.slice(0, 5)}` : ''} Uhr` : ''}`)
      const r = await queueTemplateEmail({
        templateName: 'course-transfer',
        recipientEmail: p.participant_email,
        senderUserId: context.userId,
        idempotencyKey: `course-transfer-${p.id}-${newI.course.id}`,
        templateData: {
          child_name: p.participant_name, old_course: oldI.course.name, new_course: newI.course.name,
          new_schedule: newI.course.schedule, new_location: newI.course.location,
          sessions, reason: data.reason,
          amount_due: due > 0 ? eur(due) : null, refund: due < 0 ? eur(-due) : null,
          due_date: dueDate ? formatDateBerlin(dueDate) : null,
          reference: `${newI.course.name} ${p.participant_name ?? ''} Umbuchung`,
        },
      })
      emailed = !!r.queued
    }
    const { logAudit } = await import('@/lib/audit.server')
    await logAudit(null, context.userId, {
      action: 'participant.transferred', entity: 'course_participants', entity_id: p.id,
      metadata: { to: newI.course.id, new_id: (inserted as { id: string }).id, due, reason: data.reason },
    })
    return { ok: true, emailed, due }
  })

/** Mögliche Zielkurse für eine Umbuchung (auch für Trainer:innen). */
export const listTransferTargets = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: courses } = await supabaseAdmin.from('courses')
      .select('id,name,schedule,location,max_participants').is('archived_at', null).order('name')
    const { data: parts } = await supabaseAdmin.from('course_participants')
      .select('course_id').eq('status', 'confirmed')
    const cnt = new Map<string, number>()
    for (const p of parts ?? []) cnt.set(p.course_id, (cnt.get(p.course_id) ?? 0) + 1)
    return (courses ?? []).map(c => ({
      id: c.id, name: c.name, schedule: c.schedule, location: c.location,
      free: c.max_participants != null ? c.max_participants - (cnt.get(c.id) ?? 0) : null,
    }))
  })
