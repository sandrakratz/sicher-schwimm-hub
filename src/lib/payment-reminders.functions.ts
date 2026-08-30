import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

/**
 * Versendet Zahlungserinnerungen an alle bestätigten, unbezahlten Teilnehmer,
 * bei denen eine Sofortzahlung erwartet wird oder die Zahlung überfällig ist.
 * Mit `dryRun` lässt sich die Liste vorab prüfen.
 */
export const sendPaymentReminders = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dryRun?: boolean; courseId?: string | null } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const { userId } = context
    const { data: isStaff } = await context.supabase.rpc('is_staff', { _user_id: userId })
    if (!isStaff) throw new Error('Forbidden')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { paymentState } = await import('@/lib/payment-status')
    const { queueTemplateEmail } = await import('@/lib/email-send.server')

    let query = supabaseAdmin
      .from('course_participants')
      .select(
        'id, participant_name, participant_email, price_amount, paid, status, created_at, document_no, document_issued_at, payment_method, payment_due_date, payer_street, payer_zip, payer_city, course_id, courses(name, starts_on, ends_on, schedule, location, unit_count, payment_due_days, program_id, course_programs(name))',
      )
      .eq('status', 'confirmed')
      .eq('paid', false)
    if (data.courseId) query = query.eq('course_id', data.courseId)

    const { data: rows, error } = await query
    if (error) throw new Error(error.message)

    const today = new Date().toISOString().slice(0, 10)
    const sent: Array<{ name: string; email: string; kind: string }> = []
    const skipped: Array<{ name: string; reason: string }> = []

    for (const r of rows ?? []) {
      const course = (r as any).courses
      const state = paymentState({
        paid: false,
        bookedAt: r.created_at,
        startsOn: course?.starts_on ?? null,
        paymentDueDays: course?.payment_due_days ?? null,
        method: r.payment_method,
        dueDate: r.payment_due_date,
      })
      if (state.key !== 'immediate' && state.key !== 'overdue') continue

      const email = (r.participant_email || '').trim()
      const name = r.participant_name || '—'
      if (!email) {
        skipped.push({ name, reason: 'keine E-Mail hinterlegt' })
        continue
      }

      if (data.dryRun) {
        sent.push({ name, email, kind: state.key })
        continue
      }

      const res = await queueTemplateEmail({
        templateName: 'payment-reminder',
        recipientEmail: email,
        idempotencyKey: `payment-reminder-${r.id}-${today}`,
        senderUserId: userId,
        templateData: {
          document_no: r.document_no,
          issued_at: r.document_issued_at ?? r.created_at,
          payer_name: name,
          payer_street: r.payer_street,
          payer_zip: r.payer_zip,
          payer_city: r.payer_city,
          child_name: name,
          course_name: course?.name ?? null,
          program_name: course?.course_programs?.name ?? null,
          starts_on: course?.starts_on ?? null,
          ends_on: course?.ends_on ?? null,
          schedule: course?.schedule ?? null,
          location: course?.location ?? null,
          unit_count: course?.unit_count ?? null,
          price_amount: r.price_amount != null ? Number(r.price_amount) : null,
          payment_due_days: course?.payment_due_days ?? null,
          reminder_kind: state.key,
        },
        metadata: { participant_id: r.id, kind: state.key },
      })

      if (res.queued) sent.push({ name, email, kind: state.key })
      else skipped.push({ name, reason: res.reason || 'nicht versendet' })
    }

    if (data.dryRun) return { dryRun: true, candidates: sent.length, sent: [], skipped }

    return { dryRun: false, sentCount: sent.length, sent, skipped }
  })
