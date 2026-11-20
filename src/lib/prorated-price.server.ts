// Server-only: liest die angelegten Termine eines Kurses und kürzt den Preis anteilig
// (Regel siehe prorated-price.ts). `bookedOn` = Berliner Buchungstag, Standard heute.
import { proratePrice, type ProratedPrice } from "@/lib/prorated-price";
import { todayBerlinIso } from "@/lib/format";

export async function proratedCoursePrice(
  courseId: string,
  fullPrice: number | null,
  bookedOn: string = todayBerlinIso(),
): Promise<ProratedPrice> {
  if (fullPrice == null) return proratePrice(null, [], bookedOn);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("course_sessions")
    .select("session_date")
    .eq("course_id", courseId);
  if (error) throw new Error(error.message);
  return proratePrice(
    Number(fullPrice),
    (data ?? []).map((s) => s.session_date as string),
    bookedOn,
  );
}

/** Berliner Kalendertag eines Zeitstempels (z. B. `created_at` einer Buchung). */
export function berlinDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date(iso));
}
