import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  mode: z.enum(["offer", "book"]),
  courseId: z.string().uuid(),
  childName: z.string().trim().min(1).max(160),
  childDob: z.string().trim().max(10).nullable(),
  parentName: z.string().trim().max(160),
  parentEmail: z.string().trim().email().max(255),
  parentPhone: z.string().trim().max(40).nullable(),
  /** Kurs, aus dem das Kind kommt – nur für die Notiz am Eintrag */
  fromCourse: z.string().trim().max(200),
});

type EntryRow = Database["public"]["Tables"]["waitlist_entries"]["Row"];

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Folgekurs aus der Verwaltung: nach dem Gespräch mit den Eltern entweder einen Platz anbieten
 * (Eltern bekommen die übliche Angebots-E-Mail mit Zusage-Link) oder verbindlich zubuchen
 * (Buchungsbestätigung und Zahlungsfrist wie bei „Direkt buchen“ in der Anfrageliste).
 * Beides läuft über einen Wartelisteneintrag: Steht das Kind schon wartend in der Liste, wird dieser
 * Eintrag genutzt, sonst wird einer angelegt. Scheitert der Vorgang, wird ein neu angelegter
 * Eintrag wieder entfernt.
 */
export const placeFollowupChild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!isStaff) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("*, course_programs(*)")
      .eq("id", data.courseId)
      .maybeSingle();
    if (!course) throw new Error("Kurs nicht gefunden");
    const program =
      (course as unknown as { course_programs: { bookable: boolean | null } | null })
        .course_programs ?? null;
    if (course.archived_at) throw new Error("Dieser Kurs ist archiviert");
    if (data.mode === "offer" && program?.bookable === false) {
      throw new Error(
        "Dieses Kursangebot ist derzeit nicht buchbar – es können keine Plätze angeboten werden",
      );
    }

    // Bestehenden wartenden Eintrag dieses Kindes nutzen, sonst neu anlegen
    const { data: waiting } = await supabaseAdmin
      .from("waitlist_entries")
      .select("*")
      .eq("status", "waiting")
      .ilike("parent_email", data.parentEmail);
    let entry: EntryRow | null =
      (waiting ?? []).find((e) => norm(e.child_name) === norm(data.childName)) ?? null;
    let created = false;
    if (!entry) {
      const { data: inserted, error } = await supabaseAdmin
        .from("waitlist_entries")
        .insert({
          program_id: course.program_id ?? null,
          course_id: course.id,
          child_name: data.childName,
          child_dob: data.childDob || null,
          parent_name: data.parentName || data.childName,
          parent_email: data.parentEmail,
          parent_phone: data.parentPhone || null,
          is_member: null,
          notes: `Folgekurs aus der Verwaltung angelegt (zuletzt: ${data.fromCourse}).`,
          gdpr_consent: true,
          status: "waiting",
        })
        .select("*")
        .maybeSingle();
      if (error || !inserted)
        throw new Error(error?.message ?? "Eintrag konnte nicht angelegt werden");
      entry = inserted;
      created = true;
    }

    const { logAudit } = await import("@/lib/audit.server");
    const audit = (action: string, metadata: Record<string, unknown>) =>
      logAudit(context.supabase, context.userId, {
        action,
        entity: "waitlist_entries",
        entity_id: entry!.id,
        metadata,
      });

    try {
      if (data.mode === "offer") {
        const { offerPlaceManually, freeSlots } = await import("@/lib/waitlist.server");
        const free = await freeSlots(course.id, course.max_participants);
        if (free != null && free <= 0) throw new Error("In diesem Kurs ist kein Platz mehr frei");
        await offerPlaceManually(entry, course, program);
        await audit("waitlist.offered", {
          child: entry.child_name,
          email: entry.parent_email,
          course: course.name,
          via: "folgekurse",
        });
        return { ok: true as const, mode: "offer" as const, courseName: course.name };
      }
      const { bookWaitlistEntry } = await import("@/lib/waitlist-booking.server");
      const booking = await bookWaitlistEntry(entry, course.id, {}, "admin");
      await audit("waitlist.booked_directly", {
        child: entry.child_name,
        email: entry.parent_email,
        course: booking.courseName,
        via: "folgekurse",
      });
      return {
        ok: true as const,
        mode: "book" as const,
        courseName: booking.courseName,
        paymentDueDate: booking.paymentDueDate,
        immediatePayment: booking.immediatePayment,
      };
    } catch (err) {
      if (created) await supabaseAdmin.from("waitlist_entries").delete().eq("id", entry.id);
      throw err;
    }
  });
