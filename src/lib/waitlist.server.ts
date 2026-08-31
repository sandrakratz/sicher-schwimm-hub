// Server-only Kernlogik der Warteliste: freie Plätze ermitteln, Platzangebote
// erzeugen (Mitglieder zuerst, danach nach Eingangsdatum), abgelaufene
// Angebote schließen und Zusagen in verbindliche Buchungen überführen.
import { formatDateBerlin } from '@/lib/format'

const SITE_BASE_URL = 'https://sicher-schwimmen.com'

export interface AllocationResult {
  offers: Array<{ entryId: string; courseId: string; email: string; expiresAt: string }>
  expired: number
}

function nowIso() {
  return new Date().toISOString()
}

/** Schließt abgelaufene Platzangebote und setzt die Einträge zurück auf „abgelaufen“. */
export async function expireOffers(): Promise<number> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data, error } = await supabaseAdmin
    .from('waitlist_entries')
    .update({ status: 'expired', offer_token: null, responded_at: nowIso() })
    .eq('status', 'offered')
    .lt('offer_expires_at', nowIso())
    .select('id')
  if (error) throw new Error(error.message)
  return (data ?? []).length
}

/** Ermittelt freie Plätze eines Kurses (Kontingent minus bestätigte Teilnehmer und offene Angebote). */
async function freeSlots(courseId: string, maxParticipants: number | null): Promise<number | null> {
  if (maxParticipants == null) return null
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const [{ data: parts }, { data: offers }] = await Promise.all([
    supabaseAdmin.from('course_participants').select('id,status').eq('course_id', courseId),
    supabaseAdmin
      .from('waitlist_entries')
      .select('id')
      .eq('status', 'offered')
      .eq('offer_course_id', courseId)
      .gte('offer_expires_at', nowIso()),
  ])
  const confirmed = (parts ?? []).filter((p) => p.status === 'confirmed').length
  return Math.max(0, maxParticipants - confirmed - (offers ?? []).length)
}

/** Mitglieder zuerst, danach nach Eintragungsdatum. */
function sortCandidates<T extends { is_member: boolean | null; created_at: string }>(rows: Array<T>) {
  return [...rows].sort((a, b) => {
    const am = a.is_member === true ? 0 : 1
    const bm = b.is_member === true ? 0 : 1
    if (am !== bm) return am - bm
    return a.created_at.localeCompare(b.created_at)
  })
}

/** Gleicht den Mitgliedsstatus über die E-Mail mit den Mitgliedschaften ab. */
async function resolveMember(email: string): Promise<boolean | null> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data } = await supabaseAdmin
    .from('memberships')
    .select('status')
    .ilike('email', email.trim())
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return data.status === 'active'
}

/** Erzeugt ein Platzangebot inklusive E-Mail an die Eltern. */
async function createOffer(entry: any, course: any, program: any) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { queueTemplateEmail } = await import('@/lib/email-send.server')

  const days = program?.waitlist_offer_days ?? 3
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')

  const { error } = await supabaseAdmin
    .from('waitlist_entries')
    .update({
      status: 'offered',
      offer_course_id: course.id,
      offer_token: token,
      offered_at: nowIso(),
      offer_expires_at: expiresAt,
      responded_at: null,
    })
    .eq('id', entry.id)
    .eq('status', 'waiting')
  if (error) throw new Error(error.message)

  const price =
    entry.is_member === true
      ? course.price_member ?? program?.price_member ?? null
      : course.price_non_member ?? program?.price_non_member ?? null

  await queueTemplateEmail({
    templateName: 'waitlist-offer',
    recipientEmail: entry.parent_email,
    idempotencyKey: `waitlist-offer-${entry.id}-${course.id}`,
    templateData: {
      parent_name: entry.parent_name,
      child_name: entry.child_name,
      program_name: program?.name ?? course.name,
      course_name: course.name,
      course_starts_on: course.starts_on,
      course_ends_on: course.ends_on,
      course_schedule: course.schedule,
      course_location: course.location ?? program?.location ?? null,
      price_amount: price,
      expires_at: expiresAt,
      expires_label: formatDateBerlin(expiresAt),
      accept_url: `${SITE_BASE_URL}/warteliste/antwort?token=${token}&aktion=zusage`,
      decline_url: `${SITE_BASE_URL}/warteliste/antwort?token=${token}&aktion=absage`,
    },
    metadata: { waitlist_entry_id: entry.id, course_id: course.id },
  })

  return { entryId: entry.id as string, courseId: course.id as string, email: entry.parent_email as string, expiresAt }
}

/**
 * Vergibt freie Plätze an Wartende. Ohne `courseId` werden alle offenen,
 * öffentlichen und nicht archivierten Kurse berücksichtigt.
 */
export async function allocateWaitlist(courseId?: string | null): Promise<AllocationResult> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const expired = await expireOffers()

  let courseQuery = supabaseAdmin
    .from('courses')
    .select('*, course_programs(*)')
    .is('archived_at', null)
    .in('status', ['open', 'planned', 'waiting_list', 'fully_booked'])
  if (courseId) courseQuery = courseQuery.eq('id', courseId)

  const { data: courses, error } = await courseQuery
  if (error) throw new Error(error.message)

  const today = new Date().toISOString().slice(0, 10)
  const relevant = (courses ?? []).filter((c) => !c.ends_on || c.ends_on >= today)

  const offers: AllocationResult['offers'] = []

  for (const course of relevant) {
    const program = (course as any).course_programs ?? null
    const free = await freeSlots(course.id, course.max_participants)
    if (free == null || free <= 0) continue

    const { data: entries } = await supabaseAdmin
      .from('waitlist_entries')
      .select('*')
      .eq('status', 'waiting')
      .or(`course_id.eq.${course.id}${program ? `,program_id.eq.${program.id}` : ''}`)

    let candidates = sortCandidates(entries ?? [])
    if (candidates.length === 0) continue

    // Mitgliedsstatus nachziehen, falls noch unbekannt
    for (const c of candidates) {
      if (c.is_member == null) {
        const isMember = await resolveMember(c.parent_email)
        if (isMember != null) {
          await supabaseAdmin.from('waitlist_entries').update({ is_member: isMember }).eq('id', c.id)
          c.is_member = isMember
        }
      }
    }
    candidates = sortCandidates(candidates)

    // Mindestalter zum Kursstart prüfen – zu junge Kinder bleiben auf der Warteliste
    candidates = candidates.filter((c) =>
      meetsMinAge(c.child_dob ?? null, course.starts_on ?? null, program?.min_age_years ?? null),
    )
    if (candidates.length === 0) continue

    for (const entry of candidates.slice(0, free)) {

      try {
        offers.push(await createOffer(entry, course, program))
      } catch (err) {
        console.error('waitlist offer failed', err)
      }
    }
  }

  return { offers, expired }
}

/** Manuelles Platzangebot aus der Verwaltung heraus. */
export async function offerPlaceManually(entry: any, course: any, program: any) {
  return createOffer(entry, course, program)
}
