import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'


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
}

export interface CourseProgram {
  id: string
  name: string
  slug: string
  target_group: string | null
  age_range: string | null
  min_age_years: number | null
  description: string | null
  requirements: string | null
  duration: string | null
  location: string | null
  price_member: number | null
  price_non_member: number | null
  payment_due_days: number
  bookable: boolean
  sort_order: number
  terms: Array<CourseTerm>
  open_terms: number
  /** Summe der freien Plätze über alle Termine (null, wenn keine Kapazität hinterlegt ist) */
  free_slots_total: number | null
  /** Anzahl wartender Familien auf der Warteliste dieses Angebots */
  waitlist_count: number
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
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
    .select('id,name,program_id,starts_on,ends_on,schedule,location,max_participants,price_member,price_non_member,is_public,status,archived_at')
    .in('program_id', programIds)
    .eq('is_public', true)
    .is('archived_at', null)
    .order('starts_on', { ascending: true })

  const relevant = (courses ?? []).filter(
    (c) => c.status !== 'completed' && (!c.ends_on || c.ends_on >= today),
  )

  const counts = new Map<string, number>()
  if (relevant.length > 0) {
    const { data: parts } = await supabaseAdmin
      .from('course_participants')
      .select('course_id,status')
      .in('course_id', relevant.map((c) => c.id))
    for (const p of parts ?? []) {
      if (p.status !== 'confirmed') continue
      counts.set(p.course_id, (counts.get(p.course_id) ?? 0) + 1)
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
          location: c.location ?? p.location,
          max_participants: c.max_participants,
          confirmed_count: confirmed,
          free_slots: free,
          is_full: free != null && free <= 0,
          price_member: c.price_member ?? p.price_member,
          price_non_member: c.price_non_member ?? p.price_non_member,
        }
      })

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      target_group: p.target_group,
      age_range: p.age_range,
      min_age_years: p.min_age_years,
      description: p.description,
      requirements: p.requirements,
      duration: p.duration,
      location: p.location,
      price_member: p.price_member,
      price_non_member: p.price_non_member,
      payment_due_days: p.payment_due_days,
      bookable: (p as any).bookable !== false,
      sort_order: p.sort_order,
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
  parentName: z.string().trim().min(2).max(120),
  parentEmail: z.string().trim().email().max(200),
  parentPhone: z.string().trim().max(60).optional().or(z.literal('')),
  parentStreet: z.string().trim().min(3).max(160),
  parentZip: z.string().trim().min(4).max(12),
  parentCity: z.string().trim().min(2).max(120),
  childName: z.string().trim().min(2).max(120),
  childDob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  healthInfo: z.string().trim().max(2000).optional().or(z.literal('')),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
  isMember: z.boolean().default(false),
  acceptTerms: z.literal(true),
  gdprConsent: z.literal(true),
  website: z.string().max(0).optional(), // Honeypot
})

function ageOn(dob: string, reference: string | null): number {
  const ref = reference ? new Date(reference) : new Date()
  const birth = new Date(dob)
  let age = ref.getFullYear() - birth.getFullYear()
  const m = ref.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age -= 1
  return age
}

export const bookCourseTerm = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => bookingSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website) return { status: 'confirmed' as const, ok: true }

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    // Sperrliste prüfen: Treffer bei Eltern-E-Mail ODER Kind (Name + Geburtsdatum)
    const emailNorm = data.parentEmail.trim().toLowerCase()
    const childNorm = data.childName.trim().replace(/\s+/g, ' ').toLowerCase()
    const { data: blocked } = await supabaseAdmin
      .from('booking_blocklist')
      .select('id,email_norm,child_name_norm,child_dob')
      .eq('active', true)
      .or(`email_norm.eq.${emailNorm},child_name_norm.eq.${childNorm}`)
    const isBlocked = (blocked ?? []).some(
      (b) =>
        b.email_norm === emailNorm ||
        (b.child_name_norm === childNorm && b.child_dob === data.childDob),
    )
    if (isBlocked) {
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
          admin_notes: 'Sperrliste – Einzelfallprüfung durch den Vorstand erforderlich',
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
          health_info: data.healthInfo || '',
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

    const minAge = program?.min_age_years ?? null
    if (minAge != null) {
      const age = ageOn(data.childDob, course.starts_on)
      if (age < Number(minAge)) {
        throw new Error(
          `Für diesen Kurs ist ein Mindestalter von ${minAge} Jahren zu Kursbeginn erforderlich. Bitte stellen Sie stattdessen eine Kursanfrage.`,
        )
      }
    }

    // Belegung prüfen
    const { data: parts } = await supabaseAdmin
      .from('course_participants')
      .select('id,status')
      .eq('course_id', course.id)
    const confirmed = (parts ?? []).filter((p) => p.status === 'confirmed').length
    const isFull = course.max_participants != null && confirmed >= course.max_participants
    const status: 'confirmed' | 'waiting' = isFull ? 'waiting' : 'confirmed'

    const price = data.isMember
      ? course.price_member ?? program?.price_member ?? null
      : course.price_non_member ?? program?.price_non_member ?? null

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
        assigned_course_id: course.id,
        admin_notes: 'Online-Buchung über die Webseite',
      })
      .select('id')
      .maybeSingle()

    const issuedAt = new Date().toISOString()
    let documentNo: string | null = null
    if (!isFull) {
      const { data: docNo } = await supabaseAdmin.rpc('generate_course_document_no')
      documentNo = (docNo as string | null) ?? null
    }

    // Serverseitig verbindlich berechnete Zahlungsbedingungen (manipulationssicher)
    const { paymentTerms } = await import('@/lib/payment-status')
    const dueDays = course.payment_due_days ?? program?.payment_due_days ?? 14
    const terms = paymentTerms({ bookedAt: issuedAt, startsOn: course.starts_on, paymentDueDays: dueDays })
    const paymentMethod = isFull ? null : terms.immediate ? 'immediate' : 'transfer'
    const paymentDueDate = isFull ? null : terms.dueDate.toISOString().slice(0, 10)

    const { error: partErr } = await supabaseAdmin.from('course_participants').insert({
      course_id: course.id,
      request_id: request?.id ?? null,
      payment_method: paymentMethod,
      payment_due_date: paymentDueDate,
      participant_name: data.childName,
      participant_email: data.parentEmail,
      participant_phone: data.parentPhone || null,
      payer_street: data.parentStreet,
      payer_zip: data.parentZip,
      payer_city: data.parentCity,
      date_of_birth: data.childDob,
      status,
      notes: data.healthInfo || null,
      is_member: data.isMember,
      price_amount: price,
      online_booking: true,
      paid: false,
      document_no: documentNo,
      document_issued_at: documentNo ? issuedAt : null,
    })
    if (partErr) throw new Error(partErr.message)

    const { queueTemplateEmail } = await import('@/lib/email-send.server')

    await queueTemplateEmail({
      templateName: isFull ? 'course-waitlist-confirmation' : 'course-booking-confirmation',
      recipientEmail: data.parentEmail,
      idempotencyKey: `course-booking-${request?.id ?? course.id}-${data.parentEmail}`,
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
        unit_count: course.unit_count ?? null,
        waitlist: isFull,
        is_member: data.isMember,
        price_amount: price,
        payment_due_days: dueDays,
        payment_method: paymentMethod,
        payment_due_date: paymentDueDate,
        document_no: documentNo ?? undefined,
        issued_at: issuedAt,
        site_base_url: SITE_BASE_URL,
      },
    })

    // Interne Benachrichtigung
    await queueTemplateEmail({
      templateName: 'course-request',
      idempotencyKey: `course-booking-admin-${request?.id ?? course.id}`,
      templateData: {
        parent_name: data.parentName,
        parent_email: data.parentEmail,
        parent_phone: data.parentPhone || '',
        child_name: data.childName,
        child_dob: data.childDob,
        desired_course: `${program?.name ?? course.name} – ${course.name}`,
        health_info: data.healthInfo || '',
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
        idempotencyKey: `immediate-payment-${request?.id ?? course.id}-${emailNorm}`,
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
