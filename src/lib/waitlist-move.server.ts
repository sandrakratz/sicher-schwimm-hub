// Server-only: gibt den Kursplatz eines Kindes frei und setzt es (dedupliziert) zurück auf die
// einzige Warteliste. Gemeinsame Grundlage für „Status → Warteliste“ und „Umbuchung → Warteliste“.
import { escapeLike } from "@/lib/like";

export async function moveToWaitlist(
  part: any,
  opts: {
    /** Vermerk im Wartelisteneintrag; Standardtext, wenn leer. */
    note?: string | null;
    /** Zusätzliche Felder für die abgesagte Buchung (z. B. interne Notiz). */
    participantUpdate?: Record<string, unknown>;
    /** Familie wartet frühestens auf einen Kurs nach dem Start des verlassenen Kurses. */
    holdUntilNextCourse?: boolean;
  } = {},
): Promise<{ courseId: string; courseName: string | null; entryId: string | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const courseId = part.course_id as string;

  const { data: course } = await supabaseAdmin
    .from("courses")
    .select("id,name,program_id,starts_on")
    .eq("id", courseId)
    .maybeSingle();

  const req = part.request_id
    ? (
        await supabaseAdmin
          .from("course_requests")
          .select("*")
          .eq("id", part.request_id)
          .maybeSingle()
      ).data
    : null;

  // 1) Kursplatz freigeben
  const { error: cancelErr } = await supabaseAdmin
    .from("course_participants")
    .update({ status: "cancelled", ...(opts.participantUpdate ?? {}) } as never)
    .eq("id", part.id);
  if (cancelErr) throw new Error(cancelErr.message);

  // 2) Wartelisteneintrag anlegen (Duplikate vermeiden)
  const email = (req?.parent_email ?? part.participant_email ?? "").toLowerCase().trim();
  const childName = (req?.child_name ?? part.participant_name ?? "Unbekannt") as string;

  // Nur gezielt suchen (Anfrage bzw. E-Mail), nicht die ganze Tabelle laden: Supabase liefert pro Abfrage höchstens 1000 Zeilen
  const cols = "id,status,request_id,parent_email,child_name,admin_notes,available_from";
  let existing: Array<{
    id: string;
    status: string;
    request_id: string | null;
    parent_email: string | null;
    child_name: string | null;
    admin_notes: string | null;
    available_from: string | null;
  }> = [];
  if (req?.id) {
    const { data: byReq } = await supabaseAdmin
      .from("waitlist_entries")
      .select(cols)
      .eq("request_id", req.id);
    existing = (byReq ?? []) as typeof existing;
  }
  if (existing.length === 0 && email) {
    const { data: byMail } = await supabaseAdmin
      .from("waitlist_entries")
      .select(cols)
      .ilike("parent_email", escapeLike(email));
    existing = (byMail ?? []) as typeof existing;
  }

  const dup = existing.find((e) => {
    if (req?.id && e.request_id === req.id) return true;
    return (
      (e.parent_email ?? "").toLowerCase().trim() === email &&
      (e.child_name ?? "").toLowerCase().trim() === childName.toLowerCase().trim() &&
      email !== ""
    );
  });

  const noteLine = opts.note?.trim()
    ? opts.note.trim()
    : `Zurück auf die Warteliste gesetzt (vorher Kurs: ${course?.name ?? courseId}).`;

  // Tag nach dem Start des verlassenen Kurses; ein späteres Wunschdatum bleibt erhalten
  let availableFrom: string | null = null;
  if (opts.holdUntilNextCourse && course?.starts_on) {
    const d = new Date(`${course.starts_on}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    const next = d.toISOString().slice(0, 10);
    availableFrom = dup?.available_from && dup.available_from > next ? dup.available_from : next;
  }

  let entryId = dup?.id ?? null;
  if (dup) {
    await supabaseAdmin
      .from("waitlist_entries")
      .update({
        status: "waiting",
        course_id: null,
        // Der verlassene Kurs gilt als „bereits angeboten“ und wird nicht sofort erneut vergeben
        offer_course_id: courseId,
        offer_token: null,
        offered_at: null,
        offer_expires_at: null,
        ...(availableFrom ? { available_from: availableFrom } : {}),
        admin_notes: [dup.admin_notes, noteLine].filter(Boolean).join("\n"),
      } as never)
      .eq("id", dup.id);
  } else {
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("waitlist_entries")
      .insert({
        program_id: course?.program_id ?? null,
        offer_course_id: courseId,
        request_id: req?.id ?? null,
        child_name: childName,
        child_dob: req?.child_dob ?? part.date_of_birth ?? null,
        parent_name: req?.parent_name ?? part.participant_name ?? childName,
        parent_email: req?.parent_email ?? part.participant_email ?? "",
        parent_phone: req?.parent_phone ?? part.participant_phone ?? null,
        parent_user_id: part.parent_user_id ?? null,
        is_member: part.is_member ?? null,
        notes: [req?.message, req?.health_info, part.notes].filter(Boolean).join("\n") || null,
        admin_notes: noteLine,
        gdpr_consent: true,
        status: "waiting",
        ...(availableFrom ? { available_from: availableFrom } : {}),
      } as never)
      .select("id")
      .maybeSingle();
    if (insErr) throw new Error(insErr.message);
    entryId = inserted?.id ?? null;
  }

  // 3) Ursprüngliche Anfrage zurücksetzen
  if (req?.id) {
    await supabaseAdmin
      .from("course_requests")
      .update({ assigned_course_id: null, status: "waiting_list" })
      .eq("id", req.id);
  }

  return { courseId, courseName: (course?.name as string | null) ?? null, entryId };
}
