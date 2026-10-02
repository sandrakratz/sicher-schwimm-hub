import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { escapeLike } from '@/lib/like'
import { todayBerlinIso } from '@/lib/format'
import { meetsMinAge, withinMaxAge } from '@/lib/waitlist-age'


const SITE_BASE_URL = 'https://sicher-schwimmen.com'

export interface CourseTerm {
  id: string
  name: string
  starts_on: string | null
  ends_on: string | null
  schedule: string | null
  location: string | null
  max_participants: number | null
  confirmed_count: number
  free_slots: number | null
  is_full: boolean
  price_member: number | null
  price_non_member: number | null
  course_info: string | null
  min_participants: number | null
  lanes: number | null
  start_tentative: boolean
  tentative_note: string | null
  /** Exakte Kurstermine inkl. Pausen, chronologisch */
  dates: Array<{ date: string; start: string | null; end: string | null; index: number | null; note: string | null }>
}

export interface CourseProgram {
  id: string
  name: string
  slug: string
  target_group: string | null
  age_range: string | null
  min_age_years: number | null
  max_age_years: number | null
  description: string | null
  requirements: string | null
  duration: string | null
  location: string | null
  price_member: number | null
  price_non_member: number | null
  payment_due_days: number
  bookable: boolean
  waitlist_open: boolean
  sort_order: number
  course_info: string | null
  terms: Array<CourseTerm>
  open_terms: number
  /** Summe der freien Plätze über alle Termine (null, wenn keine Kapazität hinterlegt ist) */
  free_slots_total: number | null
  /** Anzahl wartender Familien auf der Warteliste dieses Angebots */
  waitlist_count: number
}

function todayIso() {
  return todayBerlinIso()
}

async function loadPrograms(slug?: string): Promise<Array<CourseProgram>> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

  let programQuery = supabaseAdmin
    .from('course_programs')
    .select('*')
    .eq('is_public', true)
    .order('sort_order', { ascending: true })
  if (slug) programQuery = programQuery.eq('slug', slug)

  const { data: programs, error } = await programQuery
  if (error) throw new Error(error.message)
  if (!programs || programs.length === 0) return []

  const programIds = programs.map((p) => p.id)
  const today = todayIso()

  const { data: courses } = await supabaseAdmin
    .from('courses')
    .select('id,name,program_id,starts_on,ends_on,schedule,location,max_participants,price_member,price_non_member,is_public,status,archived_at,course_info,min_participants,lanes,start_tentative,tentative_note,session_breaks')
    .in('program_id', programIds)
    .eq('is_public', true)
    .is('archived_at', null)
    .order('starts_on', { ascending: true })

  const relevant = (courses ?? []).filter(
    (c) => c.status !== 'completed' && (!c.ends_on || c.ends_on >= today),
  )

  const counts = new Map<string, number>()
  if (relevant.length > 0) {
    const ids = relevant.map((c) => c.id)
    const [{ data: parts }, { data: held }] = await Promise.all([
      supabaseAdmin.from('course_participants').select('course_id,status').in('course_id', ids),
      supabaseAdmin
        .from('waitlist_entries')
        .select('offer_course_id')
        .eq('status', 'offered')
        .in('offer_course_id', ids)
        .gte('offer_expires_at', new Date().toISOString()),
    ])
    for (const p of parts ?? []) {
      if (p.status !== 'confirmed') continue
      counts.set(p.course_id, (counts.get(p.course_id) ?? 0) + 1)
    }
    // Plätze mit laufendem Wartelisten-Angebot sind reserviert
    for (const h of held ?? []) {
      if (!h.offer_course_id) continue
      counts.set(h.offer_course_id, (counts.get(h.offer_course_id) ?? 0) + 1)
    }
  }

  const sessMap = new Map<string, CourseTerm['dates']>()
  if (relevant.length > 0) {
    const { data: sess } = await supabaseAdmin
      .from('course_sessions')
      .select('course_id,session_index,session_date,start_time,end_time')
      .in('course_id', relevant.map((c) => c.id))
    for (const s of sess ?? []) {
      const arr = sessMap.get(s.course_id) ?? []
      arr.push({ date: s.session_date, start: s.start_time?.slice(0, 5) ?? null, end: s.end_time?.slice(0, 5) ?? null, index: s.session_index, note: null })
      sessMap.set(s.course_id, arr)
    }
    for (const c of relevant) {
      const arr = sessMap.get(c.id) ?? []
      const breaks = Array.isArray((c as any).session_breaks) ? ((c as any).session_breaks as any[]) : []
      const sessionDates = new Set(arr.map((s) => s.date))
      for (const b of breaks) if (b?.date && !sessionDates.has(String(b.date))) arr.push({ date: String(b.date), start: null, end: null, index: null, note: b.note ? String(b.note) : 'kein Termin' })
      arr.sort((a, b) => a.date.localeCompare(b.date))
      sessMap.set(c.id, arr)
    }
  }

  // Wartende Familien je Angebot (Warteliste)
  const waitCounts = new Map<string, number>()
  {
    const { data: waiting } = await supabaseAdmin
      .from('waitlist_entries')
      .select('program_id,course_id,status')
      .eq('status', 'waiting')
    const courseToProgram = new Map<string, string>()
    for (const c of relevant) if (c.program_id) courseToProgram.set(c.id, c.program_id)
    for (const w of waiting ?? []) {
      const pid = w.program_id ?? (w.course_id ? courseToProgram.get(w.course_id) : null)
      if (!pid) continue
      waitCounts.set(pid, (waitCounts.get(pid) ?? 0) + 1)
    }
  }

  return programs.map((p) => {
    const terms: Array<CourseTerm> = relevant
      .filter((c) => c.program_id === p.id)
      .map((c) => {
        const confirmed = counts.get(c.id) ?? 0
        const free = c.max_participants != null ? Math.max(0, c.max_participants - confirmed) : null
        return {
          id: c.id,
          name: c.name,
          starts_on: c.starts_on,
          ends_on: c.ends_on,
          schedule: c.schedule,
          min_participants: c.min_participants ?? null,
          lanes: c.lanes ?? null,
          start_tentative: !!c.start_tentative,
          tentative_note: c.tentative_note ?? null,
          dates: sessMap.get(c.id) ?? [],
          location: c.location ?? p.location,
          max_participants: c.max_participants,
          confirmed_count: confirmed,
          free_slots: free,
          is_full: free != null && free <= 0,
          price_member: c.price_member ?? p.price_member,
          price_non_member: c.price_non_member ?? p.price_non_member,
          course_info: (c as any).course_info ?? (p as any).course_info ?? null,
        }
      })

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      target_group: p.target_group,
      age_range: p.age_range,
      min_age_years: p.min_age_years,
      max_age_years: (p as any).max_age_years ?? null,
      description: p.description,
      requirements: p.requirements,
      duration: p.duration,
      location: p.location,
      price_member: p.price_member,
      price_non_member: p.price_non_member,
      payment_due_days: p.payment_due_days,
      bookable: (p as any).bookable !== false,
      waitlist_open: (p as any).waitlist_open !== false,
      sort_order: p.sort_order,
      course_info: (p as any).course_info ?? null,
      terms,
      open_terms: terms.filter((t) => !t.is_full).length,
      free_slots_total: terms.some((t) => t.free_slots != null)
        ? terms.reduce((sum, t) => sum + (t.free_slots ?? 0), 0)
        : null,
      waitlist_count: waitCounts.get(p.id) ?? 0,
    }
  })
}

export const listCoursePrograms = createServerFn({ method: 'GET' }).handler(async () => {
  return await loadPrograms()
})

export const getCourseProgram = createServerFn({ method: 'GET' })
  .inputValidator((input: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const programs = await loadPrograms(data.slug)
    return programs[0] ?? null
  })

const bookingSchema = z.object({
  courseId: z.string().uuid(),
  parentName: z.string().trim().min(3).max(120).refine((v) => v.split(/\s+/).length >= 2, 'Vor- und Nachname erforderlich'),
  parentEmail: z.string().trim().email().max(200),
  parentPhone: z.string().trim().min(5).max(60),
  parentStreet: z.string().trim().min(3).max(160),
  parentZip: z.string().trim().min(4).max(12),
  parentCity: z.string().trim().min(2).max(120),
  childName: z.string().trim().min(2).max(120),
  childDob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  healthInfo: z.string().trim().max(2000).optional().or(z.literal('')),
  /** Ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO – Pflicht, sobald Gesundheitsangaben gemacht werden. */
  healthConsent: z.boolean().optional(),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
  isMember: z.boolean().default(false),
  acceptTerms: z.literal(true),
  gdprConsent: z.literal(true),
  website: z.string().max(0).optional(), // Honeypot
}).refine((d) => !d.healthInfo || d.healthConsent === true, {
  message: 'Für Gesundheitsangaben ist Ihre ausdrückliche Einwilligung erforderlich.',
  path: ['healthConsent'],
})

/** Nachweis der Einwilligung (Art. 7 Abs. 1 DSGVO), wird in den internen Notizen der Anfrage vermerkt. */
function healthConsentNote(healthInfo: string | undefined): string {
  return healthInfo
    ? ` · Einwilligung zu Gesundheitsangaben (Art. 9 Abs. 2 lit. a DSGVO) erteilt am ${new Date().toISOString()}`
    : ''
}

export const bookCourseTerm = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => bookingSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website) return { status: 'confirmed' as const, ok: true }

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    // Sperrliste prüfen: Treffer bei Eltern-E-Mail ODER Kind (Name + Geburtsdatum)
    const { isBlocked, normalizeEmail } = await import('@/lib/blocklist.server')
    const emailNorm = normalizeEmail(data.parentEmail)
    if (await isBlocked({ email: data.parentEmail, childName: data.childName, childDob: data.childDob })) {
      // Keine Direktbuchung: stattdessen Kursanfrage zur Einzelfallprüfung anlegen
      const { data: courseInfo } = await supabaseAdmin
        .from('courses')
        .select('name,starts_on,ends_on,schedule,location, course_programs(name,location)')
        .eq('id', data.courseId)
        .maybeSingle()
      const desired =
        ((courseInfo as any)?.course_programs?.name as string | undefined) ??
        courseInfo?.name ??
        'Kursanfrage'

      const { data: req } = await supabaseAdmin
        .from('course_requests')
        .insert({
          parent_name: data.parentName,
          parent_email: data.parentEmail,
          parent_phone: data.parentPhone || null,
          child_name: data.childName,
          child_dob: data.childDob,
          desired_course: desired,
          health_info: data.healthInfo || null,
          message: data.message || null,
          gdpr_consent: true,
          contact_permission: true,
          status: 'new',
          admin_notes: `Sperrliste – Einzelfallprüfung durch den Vorstand erforderlich${healthConsentNote(data.healthInfo)}`,
        })
        .select('id')
        .maybeSingle()

      const { queueTemplateEmail } = await import('@/lib/email-send.server')
      await queueTemplateEmail({
        templateName: 'course-request',
        idempotencyKey: `course-blocked-${req?.id ?? data.courseId}-${emailNorm}`,
        templateData: {
          parent_name: data.parentName,
          parent_email: data.parentEmail,
          parent_phone: data.parentPhone || '',
          child_name: data.childName,
          child_dob: data.childDob,
          desired_course: `${desired} – ${courseInfo?.name ?? ''}`,
          has_health_info: Boolean(data.healthInfo),
          health_consent: data.healthInfo ? true : undefined,
          terms_accepted: true,
          privacy_accepted: true,
          message: `SPERRLISTE – Einzelfallprüfung erforderlich (keine Direktbuchung)${data.message ? ` – ${data.message}` : ''}`,
          submitted_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          program_name: desired,
          course_name: courseInfo?.name ?? null,
          course_starts_on: courseInfo?.starts_on ?? null,
          course_ends_on: courseInfo?.ends_on ?? null,
          course_schedule: courseInfo?.schedule ?? null,
          course_location:
            courseInfo?.location ?? ((courseInfo as any)?.course_programs?.location as string | undefined) ?? null,
          booking_status: 'Sperrliste – Einzelfallprüfung',
        },
      })

      return { ok: false as const, blocked: true as const }
    }


    const { data: course, error: courseErr } = await supabaseAdmin
      .from('courses')
      .select('*, course_programs(*)')
      .eq('id', data.courseId)
      .maybeSingle()

    if (courseErr) throw new Error(courseErr.message)
    if (!course || !course.is_public || course.archived_at) {
      throw new Error('Dieser Kurs ist derzeit nicht buchbar.')
    }
    if ((course as any).course_programs && (course as any).course_programs.bookable === false) {
      throw new Error('Dieses Angebot ist derzeit noch nicht buchbar.')
    }


    const program = (course as any).course_programs as
      | {
          id: string
          name: string
          min_age_years: number | null
          max_age_years: number | null
          age_range: string | null
          target_group: string | null
          duration: string | null
          location: string | null
          description: string | null
          price_member: number | null
          price_non_member: number | null
          payment_due_days: number
        }
      | null

    // Alter zu Kursbeginn (gleiche Rechenregel wie bei der Warteliste, siehe waitlist-age.ts)
    const minAge = program?.min_age_years ?? null
    if (minAge != null && !meetsMinAge(data.childDob, course.starts_on, minAge)) {
      throw new Error(
        `Für diesen Kurs ist ein Mindestalter von ${minAge} Jahren zu Kursbeginn erforderlich. Bitte stellen Sie stattdessen eine Kursanfrage.`,
      )
    }
    const maxAge = program?.max_age_years ?? null
    if (maxAge != null && !withinMaxAge(data.childDob, course.starts_on, maxAge)) {
      throw new Error(
        `Dieser Kurs ist für Kinder bis ${maxAge} Jahre zu Kursbeginn. Bitte stellen Sie stattdessen eine Kursanfrage.`,
      )
    }

    // Bestehende aktive Mitgliedschaft hat Vorrang vor der Angabe im Formular
    let isMember = data.isMember
    try {
      const { resolveMembership } = await import('@/lib/membership-lookup.server')
      const found = await resolveMembership({ email: data.parentEmail, childName: data.childName })
      if (found.isMember === true) isMember = true
    } catch (err) {
      console.error('membership lookup failed', err)
    }

    const price = isMember
      ? course.price_member ?? program?.price_member ?? null
      : course.price_non_member ?? program?.price_non_member ?? null

    const issuedAt = new Date().toISOString()

    // Serverseitig verbindlich berechnete Zahlungsbedingungen (manipulationssicher)
    const { paymentTerms } = await import('@/lib/payment-status')
    const dueDays = course.payment_due_days ?? program?.payment_due_days ?? 14
    const terms = paymentTerms({ bookedAt: issuedAt, startsOn: course.starts_on, paymentDueDays: dueDays })

    const { newPushToken } = await import('@/lib/push.server')
    const pushToken = newPushToken()

    // Platz atomar buchen: Duplikat- und Kapazitätsprüfung (inkl. reservierter Plätze aus laufenden
    // Wartelisten-Angeboten) und Eintrag laufen in einer Datenbank-Transaktion.
    const { bookSeat } = await import('@/lib/booking-seat.server')
    const seat = await bookSeat({
      courseId: course.id,
      source: 'parent',
      participant: {
        participant_name: data.childName,
        participant_email: data.parentEmail,
        participant_phone: data.parentPhone || null,
        payer_street: data.parentStreet,
        payer_zip: data.parentZip,
        payer_city: data.parentCity,
        date_of_birth: data.childDob,
        notes: data.healthInfo || null,
        is_member: isMember,
        price_amount: price,
        online_booking: true,
        payment_method: terms.immediate ? 'immediate' : 'transfer',
        payment_due_date: terms.dueDateIso,
        push_token: pushToken,
        document_issued_at: issuedAt,
      },
    })
    if (seat.result === 'course_not_found') throw new Error('Dieser Kurs ist derzeit nicht buchbar.')
    if (seat.result === 'duplicate') {
      throw new Error(
        'Für dieses Kind liegt bereits eine Buchung für diesen Kurs vor. Bitte prüfen Sie Ihr E-Mail-Postfach oder melden Sie sich bei uns.',
      )
    }
    if (seat.result === 'offer_not_valid') throw new Error('Die Buchung konnte nicht abgeschlossen werden.')

    // Ausgebucht: Familie kommt auf die (einzige) Warteliste und erhält automatisch ein Angebot, sobald ein Platz frei wird
    const isFull = seat.result === 'full'
    const status: 'confirmed' | 'waiting' = isFull ? 'waiting' : 'confirmed'
    if (isFull && (course as any).course_programs?.waitlist_open === false) {
      throw new Error('Dieser Kurs ist ausgebucht, die Warteliste ist derzeit geschlossen.')
    }
    const documentNo = seat.result === 'booked' ? seat.documentNo : null
    const paymentMethod = isFull ? null : terms.immediate ? 'immediate' : 'transfer'
    const paymentDueDate = isFull ? null : terms.dueDateIso

    // Anfrage-Datensatz für die Admin-Übersicht anlegen
    const { data: request } = await supabaseAdmin
      .from('course_requests')
      .insert({
        parent_name: data.parentName,
        parent_email: data.parentEmail,
        parent_phone: data.parentPhone || null,
        child_name: data.childName,
        child_dob: data.childDob,
        desired_course: program?.name ?? course.name,
        health_info: data.healthInfo || null,
        message: data.message || null,
        gdpr_consent: true,
        contact_permission: true,
        status: isFull ? 'waiting_list' : 'accepted',
        assigned_course_id: isFull ? null : course.id,
        admin_notes: `Online-Buchung über die Webseite${isFull ? ' (Kurs ausgebucht → Warteliste)' : ''}${healthConsentNote(data.healthInfo)}`,
      })
      .select('id')
      .maybeSingle()

    if (seat.result === 'booked') {
      if (request?.id) {
        await supabaseAdmin.from('course_participants').update({ request_id: request.id }).eq('id', seat.participantId)
      }
    } else {
      const escaped = data.childName.trim().replace(/[\\%_]/g, '\\$&')
      const { data: existingEntry } = await supabaseAdmin
        .from('waitlist_entries')
        .select('id')
        .ilike('parent_email', escapeLike(emailNorm))
        .ilike('child_name', escaped)
        .in('status', ['waiting', 'offered'])
        .limit(1)
        .maybeSingle()
      if (!existingEntry) {
        const { error: wlErr } = await supabaseAdmin.from('waitlist_entries').insert({
          program_id: program?.id ?? null,
          course_id: course.id,
          request_id: request?.id ?? null,
          child_name: data.childName,
          child_dob: data.childDob,
          parent_name: data.parentName,
          parent_email: data.parentEmail,
          parent_phone: data.parentPhone || null,
          is_member: isMember,
          notes: [data.message, data.healthInfo].filter(Boolean).join('\n') || null,
          gdpr_consent: true,
          status: 'waiting',
        })
        if (wlErr) throw new Error(wlErr.message)
      }
    }

    const bookingRef = request?.id ?? (seat.result === 'booked' ? seat.participantId : course.id)

    const { queueTemplateEmail } = await import('@/lib/email-send.server')

    await queueTemplateEmail({
      templateName: isFull ? 'course-waitlist-confirmation' : 'course-booking-confirmation',
      recipientEmail: data.parentEmail,
      idempotencyKey: `course-booking-${bookingRef}-${data.parentEmail}`,
      templateData: {
        parent_name: data.parentName,
        payer_street: data.parentStreet,
        payer_zip: data.parentZip,
        payer_city: data.parentCity,
        child_name: data.childName,
        program_name: program?.name ?? course.name,
        course_name: course.name,
        course_location: course.location ?? program?.location,
        course_schedule: course.schedule,
        course_starts_on: course.starts_on,
        course_ends_on: course.ends_on,
        course_description: program?.description ?? course.description,
        course_info: (course as any).course_info ?? (program as any)?.course_info ?? null,
        unit_count: course.unit_count ?? null,
        waitlist: isFull,
        is_member: isMember,
        price_amount: price,
        payment_due_days: dueDays,
        payment_method: paymentMethod,
        payment_due_date: paymentDueDate,
        document_no: documentNo ?? undefined,
        issued_at: issuedAt,
        site_base_url: SITE_BASE_URL,
        push_url: isFull ? undefined : `${SITE_BASE_URL}/mitteilungen?token=${pushToken}`,
      },
    })

    // Interne Benachrichtigung
    await queueTemplateEmail({
      templateName: 'course-request',
      idempotencyKey: `course-booking-admin-${bookingRef}`,
      templateData: {
        parent_name: data.parentName,
        parent_email: data.parentEmail,
        parent_phone: data.parentPhone || '',
        child_name: data.childName,
        child_dob: data.childDob,
        desired_course: `${program?.name ?? course.name} – ${course.name}`,
        has_health_info: Boolean(data.healthInfo),
        health_consent: data.healthInfo ? true : undefined,
        terms_accepted: true,
        privacy_accepted: true,
        message: `Online-Buchung (${isFull ? 'Warteliste' : 'verbindlich gebucht'})${data.message ? ` – ${data.message}` : ''}`,
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        program_name: program?.name ?? course.name,
        course_name: course.name,
        course_starts_on: course.starts_on,
        course_ends_on: course.ends_on,
        course_schedule: course.schedule,
        course_location: course.location ?? program?.location ?? null,
        booking_status: isFull ? 'Warteliste' : 'verbindlich gebucht',
      },
    })

    // Sofortzahlung: zusätzliche interne Warnung an Admins/Trainer
    if (!isFull && terms.immediate) {
      await queueTemplateEmail({
        templateName: 'immediate-payment-alert',
        idempotencyKey: `immediate-payment-${bookingRef}-${emailNorm}`,
        templateData: {
          child_name: data.childName,
          parent_name: data.parentName,
          parent_email: data.parentEmail,
          parent_phone: data.parentPhone || '',
          program_name: program?.name ?? course.name,
          course_name: course.name,
          course_starts_on: course.starts_on,
          booked_at: issuedAt,
          due_date: paymentDueDate,
          price_amount: price,
          document_no: documentNo,
          payment_reference: documentNo ? `${documentNo} / ${data.childName}` : `${course.name} – ${data.childName}`,
        },
      })
    }

    return {
      ok: true,
      status,
      courseName: course.name,
      programName: program?.name ?? course.name,
      price,
      paymentMethod,
      paymentDueDate,
      immediatePayment: !isFull && terms.immediate,
    }
  })
