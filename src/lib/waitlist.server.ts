// Server-only Kernlogik der Warteliste: freie Plätze ermitteln, Platzangebote
// erzeugen (Mitglieder zuerst, danach nach Eingangsdatum), abgelaufene
// Angebote schließen und Zusagen in verbindliche Buchungen überführen.
import { formatDateBerlin } from '@/lib/format'
import { meetsMinAge } from '@/lib/waitlist-age'

const SITE_BASE_URL = 'https://sicher-schwimmen.com'

export interface AllocationResult {
  offers: Array<{ entryId: string; courseId: string; email: string; expiresAt: string }>
  expired: number
}

function nowIso() {
  return new Date().toISOString()
}



/**
 * Schließt abgelaufene Platzangebote. Zählt wie eine Absage: beim 3. Mal wird der
 * Platz deaktiviert, sonst erhalten die Eltern die Rückfrage „Warteliste behalten?“.
 */
export async function expireOffers(): Promise<number> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data, error } = await supabaseAdmin
    .from('waitlist_entries')
    .select('*')
    .eq('status', 'offered')
    .lt('offer_expires_at', nowIso())
  if (error) throw new Error(error.message)
  for (const e of data ?? []) {
    // Sofort freigeben, damit der Platz nicht hängen bleibt
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from('waitlist_entries')
      .update({ status: 'expired', offer_token: null })
      .eq('id', e.id)
      .eq('status', 'offered')
      .select('id')
    if (claimError) {
      console.error('expire offer failed', e.id, claimError.message)
      continue
    }
    if (!claimed?.length) continue
    const count = (e.decline_count ?? 0) + 1
    try {
      if (count >= MAX_DECLINES) await deactivateEntry(e, count, 'Angebotsfrist ohne Antwort abgelaufen')
      else await sendFollowup(e, 'expired', count, 'Angebotsfrist ohne Antwort abgelaufen')
    } catch (err) {
      console.error('expire follow-up failed', err)
    }
  }
  return (data ?? []).length
}

/** Ermittelt freie Plätze eines Kurses (Kontingent minus bestätigte Teilnehmer und offene Angebote). */
export async function freeSlots(courseId: string, maxParticipants: number | null): Promise<number | null> {
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

/** Gleicht den Mitgliedsstatus mit den Mitgliedschaften ab (E-Mail, Erziehungsberechtigte, Familie, Name). */
async function resolveMember(entry: any, rows?: import('@/lib/membership-lookup.server').MemberRow[]): Promise<boolean | null> {
  const { resolveMembership } = await import('@/lib/membership-lookup.server')
  const m = await resolveMembership({ email: entry.parent_email, childName: entry.child_name }, rows)
  return m.isMember
}

/**
 * Zieht den Mitgliedsstatus eines Wartelisteneintrags nach (nur Aufwertung auf „Mitglied“
 * bzw. Klärung von „unbekannt“), damit der richtige Preis berechnet wird.
 */
export async function refreshWaitlistMember(entry: any, rows?: import('@/lib/membership-lookup.server').MemberRow[]) {
  if (entry.is_member === true) return
  const isMember = await resolveMember(entry, rows)
  if (isMember == null || (isMember === false && entry.is_member === false)) return
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  await supabaseAdmin.from('waitlist_entries').update({ is_member: isMember }).eq('id', entry.id)
  entry.is_member = isMember
}

/** Erzeugt ein Platzangebot inklusive E-Mail an die Eltern. */
async function createOffer(entry: any, course: any, program: any) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { queueTemplateEmail } = await import('@/lib/email-send.server')

  await refreshWaitlistMember(entry)
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
  let memberRows: import('@/lib/membership-lookup.server').MemberRow[] | undefined
  const { data: allPrograms } = await supabaseAdmin.from('course_programs').select('id,slug')
  const { relatedProgramIds } = await import('@/lib/waitlist-programs')

  for (const course of relevant) {
    const program = (course as any).course_programs ?? null
    // Nur öffentliche, buchbare Kurse und Angebote erhalten automatische Platzangebote
    if (course.is_public === false || program?.is_public === false || program?.bookable === false) continue
    const free = await freeSlots(course.id, course.max_participants)
    if (free == null || free <= 0) continue

    const pids = relatedProgramIds(program?.id ?? null, allPrograms ?? [])
    const { data: entries } = await supabaseAdmin
      .from('waitlist_entries')
      .select('*')
      .eq('status', 'waiting')
      .or([`course_id.eq.${course.id}`, ...pids.map((id) => `program_id.eq.${id}`)].join(','))

    let candidates = sortCandidates(entries ?? [])
    if (candidates.length === 0) continue

    // Mitgliedsstatus nachziehen (auch „Nein“ kann inzwischen überholt sein)
    memberRows ??= await (await import('@/lib/membership-lookup.server')).loadMemberships()
    for (const c of candidates) await refreshWaitlistMember(c, memberRows)
    candidates = sortCandidates(candidates)

    // Mindestalter zum Kursstart prüfen – zu junge Kinder bleiben auf der Warteliste
    candidates = candidates.filter((c) =>
      meetsMinAge(c.child_dob ?? null, course.starts_on ?? null, program?.min_age_years ?? null),
    )
    // Wer genau diesen Kurs bereits abgelehnt hat bzw. verfallen ließ, bekommt ihn nicht erneut automatisch
    candidates = candidates.filter((c: any) => c.offer_course_id !== course.id)
    // Zurückgestellte Kinder erst für Kurse ab dem hinterlegten Datum berücksichtigen
    candidates = candidates.filter((c: any) => {
      const from = c.available_from as string | null
      if (!from) return true
      return !!course.starts_on && course.starts_on >= from
    })
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

/* ------------------------- Absagen & Rückfragen ------------------------- */

/** Nach so vielen Absagen/abgelaufenen Angeboten wird der Wartelistenplatz deaktiviert. */
export const MAX_DECLINES = 3
/** Frist in Tagen für die Rückfrage „Weiter auf der Warteliste bleiben?“. */
export const FOLLOWUP_DAYS = 7

function stampNote(prev: string | null | undefined, text: string) {
  const stamp = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })
  return `${prev ? `${prev}\n` : ''}[${stamp}] ${text}`
}

function newToken() {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
}

/**
 * Wer ein Angebot ablehnt (oder nicht beantwortet), wird frühestens für den nächsten Kurs wieder
 * berücksichtigt: Kurse, die nicht nach dem abgelehnten Kurs starten, werden nicht mehr angeboten.
 * Ein später gewünschtes Datum der Eltern bleibt erhalten.
 */
export async function earliestAfterOffer(entry: any, requested: string | null): Promise<string | null> {
  if (!entry.offer_course_id) return requested
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data: c } = await supabaseAdmin.from('courses').select('starts_on').eq('id', entry.offer_course_id).maybeSingle()
  if (!c?.starts_on) return requested
  const d = new Date(`${c.starts_on}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  const next = d.toISOString().slice(0, 10)
  return !requested || requested < next ? next : requested
}

/** Deaktiviert einen Wartelistenplatz nach zu vielen Absagen und informiert die Eltern. */
async function deactivateEntry(entry: any, count: number, note: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { queueTemplateEmail } = await import('@/lib/email-send.server')
  const { error } = await supabaseAdmin
    .from('waitlist_entries')
    .update({
      status: 'removed',
      decline_count: count,
      offer_token: null,
      followup_token: null,
      followup_expires_at: null,
      responded_at: nowIso(),
      admin_notes: stampNote(entry.admin_notes, `${note} → ${count}. Absage: Wartelistenplatz automatisch deaktiviert (nur über Vorstand).`),
    })
    .eq('id', entry.id)
  if (error) throw new Error(`Wartelistenplatz konnte nicht deaktiviert werden: ${error.message}`)
  await queueTemplateEmail({
    templateName: 'waitlist-deactivated',
    recipientEmail: entry.parent_email,
    idempotencyKey: `waitlist-deactivated-${entry.id}-${count}`,
    templateData: { parent_name: entry.parent_name, child_name: entry.child_name, count },
    metadata: { waitlist_entry_id: entry.id },
  })
}

/** Verschickt die Rückfrage, ob das Kind auf der Warteliste bleiben soll (7 Tage Frist). */
export async function sendFollowup(entry: any, reason: 'declined' | 'expired', count: number, note: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { queueTemplateEmail } = await import('@/lib/email-send.server')
  const token = newToken()
  const expiresAt = new Date(Date.now() + FOLLOWUP_DAYS * 86400000).toISOString()
  const { error } = await supabaseAdmin
    .from('waitlist_entries')
    .update({
      status: reason,
      decline_count: count,
      offer_token: null,
      followup_token: token,
      followup_expires_at: expiresAt,
      responded_at: nowIso(),
      admin_notes: stampNote(entry.admin_notes, `${note} (${count}. Absage) – Rückfrage „Warteliste behalten?“ verschickt, Frist ${formatDateBerlin(expiresAt)}.`),
    })
    .eq('id', entry.id)
  if (error) throw new Error(`Rückfrage konnte nicht gespeichert werden: ${error.message}`)
  await queueTemplateEmail({
    templateName: 'waitlist-followup',
    recipientEmail: entry.parent_email,
    idempotencyKey: `waitlist-followup-${entry.id}-${count}`,
    templateData: {
      parent_name: entry.parent_name,
      child_name: entry.child_name,
      reason,
      count,
      max: MAX_DECLINES,
      expires_label: formatDateBerlin(expiresAt),
      answer_url: `${SITE_BASE_URL}/warteliste/rueckfrage?token=${token}`,
    },
    metadata: { waitlist_entry_id: entry.id },
  })
}

/** Absage direkt über die Antwortseite – inkl. Entscheidung zum Verbleib. */
export async function registerDecline(
  entry: any,
  opts: { stay: boolean; availableFrom: string | null; reason: string | null; courseName: string | null },
): Promise<{ deactivated: boolean; count: number }> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const count = (entry.decline_count ?? 0) + 1
  const base = `Angebot${opts.courseName ? ` „${opts.courseName}“` : ''} abgesagt${opts.reason ? ` (Grund: ${opts.reason})` : ''}`
  if (count >= MAX_DECLINES) {
    await deactivateEntry(entry, count, base)
    return { deactivated: true, count }
  }
  const availableFrom = opts.stay ? await earliestAfterOffer(entry, opts.availableFrom) : null
  const stayNote = opts.stay
    ? `bleibt auf der Warteliste, frühestens für Kurse ab ${availableFrom ? formatDateBerlin(availableFrom) : 'sofort'}`
    : 'möchte nicht auf der Warteliste bleiben'
  const { error } = await supabaseAdmin
    .from('waitlist_entries')
    .update({
      status: opts.stay ? 'waiting' : 'removed',
      decline_count: count,
      offer_token: null,
      // offer_course_id bleibt als „zuletzt abgelehnter Kurs“ stehen, damit
      // allocateWaitlist denselben Kurs nicht sofort erneut anbietet.
      offer_expires_at: null,
      followup_token: null,
      followup_expires_at: null,
      responded_at: nowIso(),
      last_decline_reason: opts.reason,
      ...(opts.stay ? { available_from: availableFrom } : {}),
      admin_notes: stampNote(entry.admin_notes, `${base} → ${count}. Absage, ${stayNote}.`),
    })
    .eq('id', entry.id)
  if (error) throw new Error(`Absage konnte nicht gespeichert werden: ${error.message}`)
  return { deactivated: false, count }
}

/** Antwort auf die Rückfrage-Mail. */
export async function answerFollowup(entry: any, stay: boolean, requestedFrom: string | null) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const availableFrom = stay ? await earliestAfterOffer(entry, requestedFrom) : null
  const { error } = await supabaseAdmin
    .from('waitlist_entries')
    .update({
      status: stay ? 'waiting' : 'removed',
      followup_token: null,
      followup_expires_at: null,
      // offer_course_id bleibt stehen (abgelehnter/abgelaufener Kurs wird nicht erneut angeboten)
      offer_expires_at: null,
      responded_at: nowIso(),
      ...(stay ? { available_from: availableFrom } : {}),
      admin_notes: stampNote(
        entry.admin_notes,
        stay
          ? `Rückfrage beantwortet: bleibt auf der Warteliste, frühestens für Kurse ab ${availableFrom ? formatDateBerlin(availableFrom) : 'sofort'}.`
          : 'Rückfrage beantwortet: möchte nicht mehr auf der Warteliste stehen.',
      ),
    })
    .eq('id', entry.id)
  if (error) throw new Error(`Antwort konnte nicht gespeichert werden: ${error.message}`)
}

/** Rückfragen ohne Antwort nach Fristablauf: Wartelistenplatz streichen (keine Sperrliste). */
export async function expireFollowups(): Promise<number> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data } = await supabaseAdmin
    .from('waitlist_entries')
    .select('id,admin_notes')
    .in('status', ['declined', 'expired'])
    .not('followup_token', 'is', null)
    .lt('followup_expires_at', nowIso())
  for (const e of data ?? []) {
    await supabaseAdmin
      .from('waitlist_entries')
      .update({
        status: 'removed',
        followup_token: null,
        admin_notes: stampNote(e.admin_notes, 'Keine Antwort auf die Rückfrage – Wartelistenplatz gestrichen.'),
      })
      .eq('id', e.id)
  }
  return (data ?? []).length
}

/** Einmalig/laufend: Absagen ohne Rückfrage (Altbestand) nachfassen. */
export async function sendMissingFollowups(): Promise<number> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data } = await supabaseAdmin
    .from('waitlist_entries')
    .select('*')
    .in('status', ['declined', 'expired'])
    .is('followup_token', null)
    .is('followup_expires_at', null)
  let n = 0
  for (const e of data ?? []) {
    const count = Math.max(1, e.decline_count ?? 0)
    try {
      await sendFollowup(e, e.status as 'declined' | 'expired', count, e.status === 'declined' ? 'Angebot abgesagt (vor Einführung der Rückfrage)' : 'Frist abgelaufen')
      n++
    } catch (err) {
      console.error('followup failed', err)
    }
  }
  return n
}
