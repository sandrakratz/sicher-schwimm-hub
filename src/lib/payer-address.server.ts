// Server-only: bereits hinterlegte Rechnungsadresse einer Familie, damit sie nicht erneut erfragt wird.

export type Address = { street: string | null; zip: string | null; city: string | null };

/** Letzte hinterlegte Rechnungsadresse zu dieser E-Mail-Adresse (frühere Buchung vor Mitgliedschaft). */
export async function findPayerAddress(
  email: string,
): Promise<{ address: Address; addressFrom: "booking" | "membership" | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: booked } = await supabaseAdmin
    .from("course_participants")
    .select("payer_street,payer_zip,payer_city")
    .ilike("participant_email", email)
    .not("payer_street", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  const b = booked?.[0];
  if (b?.payer_street)
    return {
      address: { street: b.payer_street, zip: b.payer_zip, city: b.payer_city },
      addressFrom: "booking",
    };
  const { data: members } = await supabaseAdmin
    .from("memberships")
    .select("address_street,address_zip,address_city")
    .ilike("email", email)
    .not("address_street", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  const m = members?.[0];
  if (m?.address_street)
    return {
      address: { street: m.address_street, zip: m.address_zip, city: m.address_city },
      addressFrom: "membership",
    };
  return { address: { street: null, zip: null, city: null }, addressFrom: null };
}
