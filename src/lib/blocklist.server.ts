// Server-only: Prüfung der Sperrliste für Online-Buchung und Warteliste.
// Die Werte werden bewusst über .eq() abgefragt und nicht in einen .or()-Filter
// eingesetzt – Kommas oder Klammern im Kindernamen würden sonst den Filter
// zerstören und die Prüfung wirkungslos machen.

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function normalizeChildName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Treffer bei Eltern-E-Mail ODER beim Kind (Name; ist beim Sperrlisten-Eintrag ein
 * Geburtsdatum hinterlegt, muss es übereinstimmen). Schlägt die Abfrage fehl,
 * wird ein Fehler geworfen – im Zweifel keine Buchung statt einer ungeprüften.
 */
export async function isBlocked(input: {
  email: string
  childName: string
  childDob: string | null
}): Promise<boolean> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const email = normalizeEmail(input.email)
  const child = normalizeChildName(input.childName)

  const [byEmail, byChild] = await Promise.all([
    email
      ? supabaseAdmin.from('booking_blocklist').select('id').eq('active', true).eq('email_norm', email).limit(1)
      : Promise.resolve({ data: [], error: null }),
    child
      ? supabaseAdmin.from('booking_blocklist').select('id,child_dob').eq('active', true).eq('child_name_norm', child)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (byEmail.error || byChild.error) {
    console.error('blocklist check failed', byEmail.error ?? byChild.error)
    throw new Error('Die Buchung konnte gerade nicht geprüft werden. Bitte versuchen Sie es später erneut.')
  }

  if ((byEmail.data ?? []).length > 0) return true
  return (byChild.data ?? []).some((b: { child_dob: string | null }) => !b.child_dob || b.child_dob === input.childDob)
}
