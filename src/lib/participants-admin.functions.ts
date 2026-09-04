import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const removeSchema = z.object({
  participantId: z.string().uuid(),
  reason: z.string().trim().max(500).optional().or(z.literal('')),
  blocklist: z.boolean(),
  /** Welche E-Mail an die Eltern gehen soll. */
  notify: z.enum(['unpaid', 'agreed', 'none']).default('none'),
  /** Optionale persönliche Ergänzung in der E-Mail. */
  note: z.string().trim().max(1000).optional().or(z.literal('')),
})

/**
 * Entfernt einen Kursteilnehmer, legt auf Wunsch (Standard bei
 * Nichtzahlung) einen Sperrlisteneintrag an und informiert die Eltern
 * optional per E-Mail.
 */
export const removeCourseParticipant = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => removeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc('is_staff', { _user_id: context.userId })
    if (!isStaff) throw new Error('Forbidden')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: part } = await supabaseAdmin
      .from('course_participants')
      .select(
        'id,course_id,participant_name,participant_email,date_of_birth,paid,courses(name,starts_on)',
      )
      .eq('id', data.participantId)
      .maybeSingle()
    if (!part) throw new Error('Teilnehmer nicht gefunden')

    const reason = (data.reason || '').trim() || 'Aus Kurs entfernt'
    const courseName = (part as any).courses?.name ?? null

    if (data.blocklist) {
      const email = (part.participant_email ?? '').trim().toLowerCase() || null
      const child = (part.participant_name ?? '').trim().replace(/\s+/g, ' ').toLowerCase() || null
      if (email || child) {
        await supabaseAdmin.from('booking_blocklist').insert({
          child_name_norm: child,
          child_dob: part.date_of_birth,
          email_norm: email,
          reason,
          source: 'manual',
          active: true,
          created_by: context.userId,
        })
      }
    }

    const { error } = await supabaseAdmin.from('course_participants').delete().eq('id', part.id)
    if (error) throw new Error(error.message)

    let emailed = false
    const recipient = (part.participant_email ?? '').trim()
    if (data.notify !== 'none' && recipient) {
      const templateName =
        data.notify === 'unpaid' ? 'course-removal-unpaid' : 'course-removal-agreed'
      try {
        const { queueTemplateEmail } = await import('@/lib/email-send.server')
        const res = await queueTemplateEmail({
          templateName,
          recipientEmail: recipient,
          templateData: {
            child_name: part.participant_name,
            course_name: courseName,
            note: (data.note || '').trim() || null,
          },
          idempotencyKey: `${templateName}-${part.id}`,
          senderUserId: context.userId,
          metadata: { course_id: part.course_id, participant_id: part.id },
        })
        emailed = res.queued
      } catch (e) {
        console.error('course removal email failed', e)
      }
    }

    const { logAudit } = await import('@/lib/audit.server')
    await logAudit(context.supabase, context.userId, {
      action: 'course_participant.removed',
      entity: 'course_participants',
      entity_id: part.id,
      metadata: {
        course_id: part.course_id,
        name: part.participant_name,
        paid: part.paid,
        reason,
        blocklisted: data.blocklist,
        notify: data.notify,
        emailed,
      },
    })

    return { ok: true as const, blocklisted: data.blocklist, emailed }
  })
