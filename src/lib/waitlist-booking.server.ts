// Server-only: Überführt einen Wartelisteneintrag in eine verbindliche Buchung
// (Teilnehmerliste, Buchungsdatum, Zahlungsdetails) und verschickt die
// Buchungsbestätigung an die Eltern sowie eine interne Kopie.

const SITE_BASE_URL = 'https://sicher-schwimmen.com'

export type BookingAddress = { street?: string | null; zip?: string | null; city?: string | null }

export type BookingResult = {
  courseName: string
  immediatePayment: boolean
  paymentDueDate: string
  documentNo: string | null
  priceAmount: number | null
}

/**
 * Bucht einen Wartelisteneintrag verbindlich in einen Kurs.
 * `source` steuert nur die Notiz/Beschriftung in Anfrage und interner E-Mail.
 */
export async function bookWaitlistEntry(
  entry: any,
  courseId: string,
  address: BookingAddress,
  source: 'parent' | 'admin' = 'parent',
): Promise<BookingResult> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('*, course_programs(*)')
    .eq('id', courseId)
    .maybeSingle()
  if (!course) throw new Error('Kurs nicht gefunden')
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

  const label = source === 'admin' ? 'Direkt aus der Warteliste gebucht' : 'Zusage über die Warteliste'

  let requestId = entry.request_id as string | null
  if (!requestId) {
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
        admin_notes: label,
      })
      .select('id')
      .maybeSingle()
    requestId = request?.id ?? null
  } else {
    await supabaseAdmin
      .from('course_requests')
      .update({ status: 'accepted', assigned_course_id: course.id })
      .eq('id', requestId)
  }

  const { error: partErr } = await supabaseAdmin.from('course_participants').insert({
    course_id: course.id,
    request_id: requestId,
    participant_name: entry.child_name,
    participant_email: entry.parent_email,
    participant_phone: entry.parent_phone,
    payer_street: address.street || null,
    payer_zip: address.zip || null,
    payer_city: address.city || null,
    date_of_birth: entry.child_dob,
    status: 'confirmed',
    notes: entry.notes,
    is_member: entry.is_member,
    price_amount: price,
    online_booking: source === 'parent',
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
      offer_course_id: course.id,
      responded_at: issuedAt,
      request_id: requestId,
    })
    .eq('id', entry.id)

  const { queueTemplateEmail } = await import('@/lib/email-send.server')
  await queueTemplateEmail({
    templateName: 'course-booking-confirmation',
    recipientEmail: entry.parent_email,
    idempotencyKey: `waitlist-accept-${entry.id}`,
    templateData: {
      parent_name: entry.parent_name,
      payer_street: address.street || '',
      payer_zip: address.zip || '',
      payer_city: address.city || '',
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
    metadata: { waitlist_entry_id: entry.id, course_id: course.id },
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
      message: `${label} – Platz verbindlich gebucht`,
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
    courseName: course.name,
    immediatePayment: terms.immediate,
    paymentDueDate,
    documentNo,
    priceAmount: price,
  }
}
