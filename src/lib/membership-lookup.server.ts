// Server-only: ordnet Kursbuchungen einer Vereinsmitgliedschaft zu und gleicht
// die Kursgebühr an (Mitglieder zahlen den Mitgliedspreis).
//
// Eine Mitgliedschaft wird erkannt über
//  - die E-Mail des Antrags, die Mitglieds-E-Mail (Minderjährige), die E-Mail der
//    Erziehungsberechtigten oder die E-Mail eines Kindes in der Familienmitgliedschaft,
//  - oder (nur bei aktiver Mitgliedschaft) den Namen des Kindes als Mitglied,
//    Partner oder Kind der Familienmitgliedschaft.

export type MemberRow = {
  id: string
  status: string
  first_name: string | null
  last_name: string | null
  email: string | null
  member_email: string | null
  guardian_email: string | null
  family_members: any
}

export type MembershipMatch = { isMember: boolean | null; membershipId: string | null }

const norm = (v: string | null | undefined) => (v ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

export async function loadMemberships(): Promise<MemberRow[]> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data, error } = await supabaseAdmin
    .from('memberships')
    .select('id,status,first_name,last_name,email,member_email,guardian_email,family_members')
    .limit(5000)
  if (error) throw new Error(error.message)
  return (data ?? []) as MemberRow[]
}

function emailsOf(m: MemberRow): string[] {
  const kids = (m.family_members?.children ?? []) as Array<{ email?: string | null }>
  return [m.email, m.member_email, m.guardian_email, ...kids.map((k) => k.email)].map(norm).filter(Boolean)
}

function namesOf(m: MemberRow): string[] {
  const fm = m.family_members ?? {}
  const kids = (fm.children ?? []) as Array<{ name?: string | null }>
  return [`${m.first_name ?? ''} ${m.last_name ?? ''}`, fm.partner?.name, ...kids.map((k) => k.name)]
    .map(norm)
    .filter((n) => n.includes(' '))
}

/** Aktive Mitgliedschaft → true, nur inaktive gefunden → false, nichts gefunden → null. */
export function matchMembership(
  rows: MemberRow[],
  q: { email?: string | null; childName?: string | null },
): MembershipMatch {
  const email = norm(q.email)
  const name = norm(q.childName)
  const byEmail = email ? rows.filter((m) => emailsOf(m).includes(email)) : []
  const active = byEmail.find((m) => m.status === 'active')
  if (active) return { isMember: true, membershipId: active.id }
  if (name.includes(' ')) {
    const byName = rows.find((m) => m.status === 'active' && namesOf(m).includes(name))
    if (byName) return { isMember: true, membershipId: byName.id }
  }
  if (byEmail.length) return { isMember: false, membershipId: byEmail[0]!.id }
  return { isMember: null, membershipId: null }
}

export async function resolveMembership(
  q: { email?: string | null; childName?: string | null },
  rows?: MemberRow[],
): Promise<MembershipMatch> {
  return matchMembership(rows ?? (await loadMemberships()), q)
}

export type RepriceResult = {
  updated: Array<{ participant: string; course: string; from: number | null; to: number | null }>
  /** Preis wurde manuell abweichend gesetzt – nur „Mitglied“ markiert, Preis unverändert. */
  keptPrice: string[]
  /** Mitglied, aber schon bezahlt – bitte manuell prüfen (z. B. Erstattung). */
  alreadyPaid: string[]
}

/**
 * Setzt bei offenen Buchungen von Mitgliedern den Mitgliedspreis. Es wird nie
 * herabgestuft und bereits bezahlte Buchungen werden nicht verändert.
 */
export async function repriceMemberParticipants(opts: { courseId?: string | null } = {}): Promise<RepriceResult> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const rows = await loadMemberships()
  const result: RepriceResult = { updated: [], keptPrice: [], alreadyPaid: [] }

  let q = supabaseAdmin
    .from('course_participants')
    .select(
      'id,participant_name,participant_email,is_member,price_amount,paid,internal_notes,course_id,courses(name,ends_on,price_member,price_non_member,course_programs(price_member,price_non_member))',
    )
    .in('status', ['confirmed', 'waiting'])
  if (opts.courseId) q = q.eq('course_id', opts.courseId)
  const { data, error } = await q
  if (error) throw new Error(error.message)

  const today = new Date().toISOString().slice(0, 10)
  const stamp = new Date().toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })

  for (const p of (data ?? []) as any[]) {
    const course = p.courses
    if (!course || (course.ends_on && course.ends_on < today)) continue
    const m = matchMembership(rows, { email: p.participant_email, childName: p.participant_name })
    if (m.isMember !== true) continue

    const program = course.course_programs ?? null
    const memberPrice = course.price_member ?? program?.price_member ?? null
    const nonMemberPrice = course.price_non_member ?? program?.price_non_member ?? null
    const current = p.price_amount == null ? null : Number(p.price_amount)
    const priceOk = memberPrice == null || current === Number(memberPrice)
    if (p.is_member === true && priceOk) continue

    const label = `${p.participant_name} (${course.name})`
    if (p.paid) {
      result.alreadyPaid.push(label)
      continue
    }

    const patch: Record<string, unknown> = { is_member: true }
    const canReprice =
      memberPrice != null && (current == null || (nonMemberPrice != null && current === Number(nonMemberPrice)))
    if (canReprice) {
      patch['price_amount'] = Number(memberPrice)
      patch['internal_notes'] = `${p.internal_notes ? `${p.internal_notes}\n` : ''}[${stamp}] Mitgliedschaft erkannt – Kursgebühr automatisch auf Mitgliedspreis ${Number(memberPrice)} € angepasst (vorher ${current ?? '–'} €).`
    } else if (!priceOk) {
      result.keptPrice.push(label)
    }

    const { error: upErr } = await supabaseAdmin.from('course_participants').update(patch as never).eq('id', p.id)
    if (upErr) throw new Error(upErr.message)
    if (canReprice) {
      result.updated.push({ participant: p.participant_name, course: course.name, from: current, to: Number(memberPrice) })
    }
  }
  return result
}
