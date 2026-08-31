import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const SITE_BASE_URL = 'https://sicher-schwimmen.com'

const joinSchema = z.object({
  programId: z.string().uuid().optional().nullable(),
  courseId: z.string().uuid().optional().nullable(),
  parentName: z.string().trim().min(2).max(120),
  parentEmail: z.string().trim().email().max(200),
  parentPhone: z.string().trim().max(60).optional().or(z.literal('')),
  childName: z.string().trim().min(2).max(120),
  childDob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
  gdprConsent: z.literal(true),
  website: z.string().max(0).optional(),
})

/** Öffentliche Eintragung auf die Warteliste (ohne Login). */
export const joinWaitlist = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => joinSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website) return { ok: true as const }

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const emailNorm = data.parentEmail.trim().toLowerCase()
    const childNorm = data.childName.trim().replace(/\s+/g, ' ').toLowerCase()

    // Sperrliste prüfen
    const { data: blocked } = await supabaseAdmin
      .from('booking_blocklist')
      .select('id,email_norm,child_name_norm,child_dob')
      .eq('active', true)
      .or(`email_norm.eq.${emailNorm},child_name_norm.eq.${childNorm}`)
    const isBlocked = (blocked ?? []).some(
      (b) =>
        b.email_norm === emailNorm ||
        (b.child_name_norm === childNorm && (!b.child_dob || b.child_dob === (data.childDob || null))),
    )
    if (isBlocked) return { ok: false as const, blocked: true as const }

    // Doppeleintrag vermeiden
    const { data: existing } = await supabaseAdmin
      .from('waitlist_entries')
      .select('id')
      .ilike('parent_email', emailNorm)
      .ilike('child_name', data.childName.trim())
      .in('status', ['waiting', 'offered'])
      .limit(1)
      .maybeSingle()
    if (existing) return { ok: true as const, duplicate: true as const }

    const { data: mem } = await supabaseAdmin
      .from('memberships')
      .select('status')
      .ilike('email', emailNorm)
      .limit(1)
      .maybeSingle()

    let programId = data.programId ?? null
    let courseName: string | null = null
    if (data.courseId) {
      const { data: course } = await supabaseAdmin
        .from('courses')
        .select('id,name,program_id')
        .eq('id', data.courseId)
        .maybeSingle()
      if (course) {
        courseName = course.name
        programId = programId ?? course.program_id
      }
    }
    let programName: string | null = null
    if (programId) {
      const { data: prog } = await supabaseAdmin
        .from('course_programs')
        .select('name')
        .eq('id', programId)
        .maybeSingle()
      programName = prog?.name ?? null
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('waitlist_entries')
      .insert({
        program_id: programId,
        course_id: data.courseId ?? null,
        child_name: data.childName,
        child_dob: data.childDob || null,
        parent_name: data.parentName,
        parent_email: data.parentEmail,
        parent_phone: data.parentPhone || null,
        is_member: mem ? mem.status === 'active' : null,
        notes: data.notes || null,
        gdpr_consent: true,
        status: 'waiting',
      })
      .select('id')
      .maybeSingle()
    if (error) throw new Error(error.message)

    const { queueTemplateEmail } = await import('@/lib/email-send.server')
    await queueTemplateEmail({
      templateName: 'waitlist-signup',
      recipientEmail: data.parentEmail,
      idempotencyKey: `waitlist-signup-${inserted?.id}`,
      templateData: {
        parent_name: data.parentName,
        child_name: data.childName,
        program_name: programName,
        course_name: courseName,
      },
      metadata: { waitlist_entry_id: inserted?.id },
    })

    await queueTemplateEmail({
      templateName: 'course-request',
      idempotencyKey: `waitlist-admin-${inserted?.id}`,
      templateData: {
        parent_name: data.parentName,
        parent_email: data.parentEmail,
        parent_phone: data.parentPhone || '',
        child_name: data.childName,
        child_dob: data.childDob || '',
        desired_course: [programName, courseName].filter(Boolean).join(' – ') || 'Warteliste',
        health_info: data.notes || '',
        message: 'Neue Eintragung auf der Warteliste über die Webseite',
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        program_name: programName,
        course_name: courseName,
        booking_status: 'Warteliste',
      },
    })

    // Falls sofort ein Platz frei ist, direkt anbieten
    try {
      const { allocateWaitlist } = await import('@/lib/waitlist.server')
      await allocateWaitlist(data.courseId ?? null)
    } catch (err) {
      console.error('waitlist allocation after signup failed', err)
    }

    return { ok: true as const }
  })

/** Lädt ein Platzangebot anhand des Tokens (öffentliche Antwortseite). */
export const getWaitlistOffer = createServerFn({ method: 'GET' })
  .inputValidator((input: { token: string }) => z.object({ token: z.string().min(10).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: entry } = await supabaseAdmin
      .from('waitlist_entries')
      .select('*, courses:offer_course_id(name,starts_on,ends_on,schedule,location,price_member,price_non_member)')
      .eq('offer_token', data.token)
      .maybeSingle()
    if (!entry) return { found: false as const }

    const course = (entry as any).courses ?? null
    const expired = entry.offer_expires_at ? new Date(entry.offer_expires_at).getTime() < Date.now() : true
    return {
      found: true as const,
      status: entry.status as string,
      expired,
      childName: entry.child_name,
      parentName: entry.parent_name,
      expiresAt: entry.offer_expires_at,
      course: course
        ? {
            name: course.name as string,
            startsOn: course.starts_on as string | null,
            endsOn: course.ends_on as string | null,
            schedule: course.schedule as string | null,
            location: course.location as string | null,
            price: (entry.is_member === true ? course.price_member : course.price_non_member) as number | null,
          }
        : null,
    }
  })

const respondSchema = z.object({
  token: z.string().min(10).max(200),
  action: z.enum(['accept', 'decline']),
  street: z.string().trim().max(160).optional().or(z.literal('')),
  zip: z.string().trim().max(12).optional().or(z.literal('')),
  city: z.string().trim().max(120).optional().or(z.literal('')),
})

/** Zusage oder Absage zu einem Platzangebot. */
export const respondWaitlistOffer = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => respondSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: entry } = await supabaseAdmin
      .from('waitlist_entries')
      .select('*')
      .eq('offer_token', data.token)
      .maybeSingle()
    if (!entry || entry.status !== 'offered') return { ok: false as const, reason: 'not_found' as const }
    if (entry.offer_expires_at && new Date(entry.offer_expires_at).getTime() < Date.now()) {
      return { ok: false as const, reason: 'expired' as const }
    }

    if (data.action === 'decline') {
      await supabaseAdmin
        .from('waitlist_entries')
        .update({ status: 'declined', offer_token: null, responded_at: new Date().toISOString() })
        .eq('id', entry.id)
      const { allocateWaitlist } = await import('@/lib/waitlist.server')
      await allocateWaitlist(entry.offer_course_id)
      return { ok: true as const, action: 'decline' as const }
    }

    if (!data.street || !data.zip || !data.city) return { ok: false as const, reason: 'address_required' as const }

    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('*, course_programs(*)')
      .eq('id', entry.offer_course_id!)
      .maybeSingle()
    if (!course) return { ok: false as const, reason: 'not_found' as const }
    const program = (course as any).course_programs ?? null

    const price =
      entry.is_member === true
        ? course.price_member ?? program?.price_member ?? null
        : course.price_non_member ?? program?.price_non_member ?? null

    const issuedAt = new Date().toISOString()
    const { data: docNo } = await supabaseAdmin.rpc('generate_course_document_no')
    const documentNo = (docNo as string | null) ?? null

    const { paymentTerms } = await import('@/lib/payment-status')
    const dueDays = course.payment_due_days ?? program?.payment_due_days ?? 14
    const terms = paymentTerms({ bookedAt: issuedAt, startsOn: course.starts_on, paymentDueDays: dueDays })
    const paymentMethod = terms.immediate ? 'immediate' : 'transfer'
    const paymentDueDate = terms.dueDate.toISOString().slice(0, 10)

    const { data: request } = await supabaseAdmin
      .from('course_requests')
      .insert({
        parent_name: entry.parent_name,
        parent_email: entry.parent_email,
        parent_phone: entry.parent_phone,
        child_name: entry.child_name,
        child_dob: entry.child_dob,
        desired_course: program?.name ?? course.name,
        health_info: entry.notes,
        gdpr_consent: true,
        contact_permission: true,
        status: 'accepted',
        assigned_course_id: course.id,
        admin_notes: 'Zusage über die Warteliste',
      })
      .select('id')
      .maybeSingle()

    const { error: partErr } = await supabaseAdmin.from('course_participants').insert({
      course_id: course.id,
      request_id: request?.id ?? null,
      participant_name: entry.child_name,
      participant_email: entry.parent_email,
      participant_phone: entry.parent_phone,
      payer_street: data.street,
      payer_zip: data.zip,
      payer_city: data.city,
      date_of_birth: entry.child_dob,
      status: 'confirmed',
      notes: entry.notes,
      is_member: entry.is_member,
      price_amount: price,
      online_booking: true,
      paid: false,
      payment_method: paymentMethod,
      payment_due_date: paymentDueDate,
      document_no: documentNo,
      document_issued_at: documentNo ? issuedAt : null,
    })
    if (partErr) throw new Error(partErr.message)

    await supabaseAdmin
      .from('waitlist_entries')
      .update({
        status: 'accepted',
        offer_token: null,
        responded_at: issuedAt,
        request_id: request?.id ?? null,
      })
      .eq('id', entry.id)

    const { queueTemplateEmail } = await import('@/lib/email-send.server')
    await queueTemplateEmail({
      templateName: 'course-booking-confirmation',
      recipientEmail: entry.parent_email,
      idempotencyKey: `waitlist-accept-${entry.id}`,
      templateData: {
        parent_name: entry.parent_name,
        payer_street: data.street,
        payer_zip: data.zip,
        payer_city: data.city,
        child_name: entry.child_name,
        program_name: program?.name ?? course.name,
        course_name: course.name,
        course_location: course.location ?? program?.location,
        course_schedule: course.schedule,
        course_starts_on: course.starts_on,
        course_ends_on: course.ends_on,
        course_description: program?.description ?? course.description,
        unit_count: course.unit_count ?? null,
        waitlist: false,
        is_member: entry.is_member,
        price_amount: price,
        payment_due_days: dueDays,
        payment_method: paymentMethod,
        payment_due_date: paymentDueDate,
        document_no: documentNo ?? undefined,
        issued_at: issuedAt,
        site_base_url: SITE_BASE_URL,
      },
    })

    await queueTemplateEmail({
      templateName: 'course-request',
      idempotencyKey: `waitlist-accept-admin-${entry.id}`,
      templateData: {
        parent_name: entry.parent_name,
        parent_email: entry.parent_email,
        parent_phone: entry.parent_phone || '',
        child_name: entry.child_name,
        child_dob: entry.child_dob || '',
        desired_course: `${program?.name ?? course.name} – ${course.name}`,
        health_info: entry.notes || '',
        message: 'Zusage über die Warteliste – Platz verbindlich gebucht',
        submitted_at: issuedAt,
        created_at: issuedAt,
        program_name: program?.name ?? course.name,
        course_name: course.name,
        course_starts_on: course.starts_on,
        course_ends_on: course.ends_on,
        course_schedule: course.schedule,
        course_location: course.location ?? program?.location ?? null,
        booking_status: 'Warteliste – verbindlich gebucht',
      },
    })

    return {
      ok: true as const,
      action: 'accept' as const,
      courseName: course.name,
      immediatePayment: terms.immediate,
      paymentDueDate,
    }
  })

/* ---------------------------- Verwaltung ---------------------------- */

async function assertStaff(context: any) {
  const { data: isStaff } = await context.supabase.rpc('is_staff', { _user_id: context.userId })
  if (!isStaff) throw new Error('Forbidden')
}

export const listWaitlist = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    // Abgelaufene Platzangebote schließen, damit Plätze nicht hängen bleiben
    try {
      const { expireOffers } = await import('@/lib/waitlist.server')
      await expireOffers()
    } catch (err) {
      console.error('expireOffers failed', err)
    }

    const [{ data: entries }, { data: programs }, { data: courses }, { data: blocklist }] = await Promise.all([
      supabaseAdmin.from('waitlist_entries').select('*').order('created_at', { ascending: true }),
      supabaseAdmin.from('course_programs').select('id,name,slug,min_age_years').order('sort_order'),
      supabaseAdmin
        .from('courses')
        .select('id,name,program_id,starts_on,max_participants,status,archived_at')
        .is('archived_at', null)
        .order('starts_on'),
      supabaseAdmin
        .from('booking_blocklist')
        .select('email_norm,child_name_norm,child_dob,reason')
        .eq('active', true),
    ])


    // Originalanfrage (komplett) nachziehen
    const requestIds = (entries ?? []).map((e) => e.request_id).filter((v): v is string => !!v)
    const requests = new Map<string, Record<string, string | number | boolean | null>>()
    if (requestIds.length) {
      const { data: reqs } = await supabaseAdmin
        .from('course_requests')
        .select('*')
        .in('id', requestIds)
      for (const r of reqs ?? []) {
        const plain: Record<string, string | number | boolean | null> = {}
        for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
          plain[k] =
            v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
              ? (v as string | number | boolean | null)
              : JSON.stringify(v)
        }
        requests.set(r.id, plain)
      }
    }


    const courseIds = (courses ?? []).map((c) => c.id)
    const counts = new Map<string, number>()
    if (courseIds.length) {
      const { data: parts } = await supabaseAdmin
        .from('course_participants')
        .select('course_id,status')
        .in('course_id', courseIds)
      for (const p of parts ?? []) {
        if (p.status === 'confirmed') counts.set(p.course_id, (counts.get(p.course_id) ?? 0) + 1)
      }
    }

    return {
      entries: (entries ?? []).map((e) => {
        const req = e.request_id ? requests.get(e.request_id) ?? null : null
        return {
          ...e,
          desired_course: (req?.['desired_course'] as string | null) ?? null,
          request: req,
        }
      }),

      programs: programs ?? [],
      courses: (courses ?? []).map((c) => ({
        ...c,
        confirmed: counts.get(c.id) ?? 0,
        free: c.max_participants != null ? Math.max(0, c.max_participants - (counts.get(c.id) ?? 0)) : null,
      })),
    }

  })

export const runWaitlistAllocation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId?: string | null } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    await assertStaff(context)
    const { allocateWaitlist } = await import('@/lib/waitlist.server')
    const result = await allocateWaitlist(data.courseId ?? null)
    return { offers: result.offers.length, expired: result.expired }
  })

export const offerWaitlistPlace = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { entryId: string; courseId: string }) =>
    z.object({ entryId: z.string().uuid(), courseId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const [{ data: entry }, { data: course }] = await Promise.all([
      supabaseAdmin.from('waitlist_entries').select('*').eq('id', data.entryId).maybeSingle(),
      supabaseAdmin.from('courses').select('*, course_programs(*)').eq('id', data.courseId).maybeSingle(),
    ])
    if (!entry || !course) throw new Error('Eintrag oder Kurs nicht gefunden')
    if (entry.status !== 'waiting') throw new Error('Für diesen Eintrag läuft bereits ein Angebot')

    const { offerPlaceManually } = await import('@/lib/waitlist.server')
    await offerPlaceManually(entry, course, (course as any).course_programs ?? null)
    return { ok: true }
  })

export const updateWaitlistEntry = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      entryId: string
      status?: string
      adminNotes?: string | null
      programId?: string | null
    }) =>
      z
        .object({
          entryId: z.string().uuid(),
          status: z.enum(['waiting', 'removed', 'declined']).optional(),
          adminNotes: z.string().max(2000).nullable().optional(),
          programId: z.string().uuid().nullable().optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const patch: Record<string, unknown> = {}
    if (data.status) {
      patch['status'] = data.status
      patch['offer_token'] = null
      patch['offer_course_id'] = null
      patch['offer_expires_at'] = null
    }
    if (data.adminNotes !== undefined) patch['admin_notes'] = data.adminNotes
    if (data.programId !== undefined) {
      patch['program_id'] = data.programId
      patch['course_id'] = null
    }
    const { error } = await supabaseAdmin.from('waitlist_entries').update(patch as never).eq('id', data.entryId)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

/**
 * Übernimmt alte Kursanfragen mit Status „Warteliste“ einmalig in die neue
 * Warteliste – inklusive Wunschkurs (Textabgleich) und Notizen. Idempotent.
 */
export const migrateWaitingRequests = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { matchProgram } = await import('@/lib/waitlist-age')

    const [{ data: requests }, { data: programs }, { data: existing }] = await Promise.all([
      supabaseAdmin
        .from('course_requests')
        .select('*')
        .neq('status', 'rejected')
        .is('assigned_course_id', null)
        .order('created_at', { ascending: true }),
      supabaseAdmin.from('course_programs').select('id,name,slug').order('sort_order'),
      supabaseAdmin.from('waitlist_entries').select('id,request_id,parent_email,child_name'),
    ])

    // Bereits in einen Kurs aufgenommene Anfragen nicht erneut auf die Warteliste holen
    const { data: participants } = await supabaseAdmin
      .from('course_participants')
      .select('request_id,participant_name,participant_email')
      .neq('status', 'cancelled')

    const enrolledRequests = new Set(
      (participants ?? []).map((p) => p.request_id).filter(Boolean) as Array<string>,
    )
    const enrolledPersons = new Set(
      (participants ?? []).map(
        (p) =>
          `${(p.participant_email ?? '').toLowerCase().trim()}|${(p.participant_name ?? '').toLowerCase().trim()}`,
      ),
    )

    const byRequest = new Set((existing ?? []).map((e) => e.request_id).filter(Boolean) as Array<string>)
    const byPerson = new Set(
      (existing ?? []).map(
        (e) => `${(e.parent_email ?? '').toLowerCase().trim()}|${(e.child_name ?? '').toLowerCase().trim()}`,
      ),
    )

    const rows: Array<Record<string, unknown>> = []
    for (const r of requests ?? []) {
      if (byRequest.has(r.id)) continue
      if (enrolledRequests.has(r.id)) continue
      const key = `${(r.parent_email ?? '').toLowerCase().trim()}|${(r.child_name ?? '').toLowerCase().trim()}`
      if (byPerson.has(key) || enrolledPersons.has(key)) continue
      byPerson.add(key)
      const prog = matchProgram(r.desired_course, programs ?? [])
      rows.push({
        program_id: prog?.id ?? null,
        request_id: r.id,
        child_name: r.child_name ?? 'Unbekannt',
        child_dob: r.child_dob,
        parent_name: r.parent_name,
        parent_email: r.parent_email,
        parent_phone: r.parent_phone,
        notes: [r.message, r.health_info, r.swimming_level ? `Schwimmniveau: ${r.swimming_level}` : null]
          .filter(Boolean)
          .join('\n') || null,
        admin_notes: r.admin_notes,
        gdpr_consent: true,
        status: 'waiting',
        created_at: r.created_at,
      })
    }

    if (rows.length) {
      const { error } = await supabaseAdmin.from('waitlist_entries').insert(rows as never)
      if (error) throw new Error(error.message)
    }
    return { migrated: rows.length }
  })


export const deleteWaitlistEntry = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { entryId: string }) => z.object({ entryId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { error } = await supabaseAdmin.from('waitlist_entries').delete().eq('id', data.entryId)
    if (error) throw new Error(error.message)
    return { ok: true }
  })
