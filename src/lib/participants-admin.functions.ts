import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const removeSchema = z.object({
  participantId: z.string().uuid(),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
  blocklist: z.boolean(),
  /** Welche E-Mail an die Eltern gehen soll. */
  notify: z.enum(["unpaid", "agreed", "none"]).default("none"),
  /** Optionale persönliche Ergänzung in der E-Mail. */
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});

/**
 * Entfernt einen Kursteilnehmer, legt auf Wunsch (Standard bei
 * Nichtzahlung) einen Sperrlisteneintrag an und informiert die Eltern
 * optional per E-Mail.
 */
export const removeCourseParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => removeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!isStaff) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: part } = await supabaseAdmin
      .from("course_participants")
      .select(
        "id,course_id,request_id,participant_name,participant_email,date_of_birth,paid,courses!course_participants_course_id_fkey(name,starts_on)",
      )
      .eq("id", data.participantId)
      .maybeSingle();
    if (!part) throw new Error("Teilnehmer nicht gefunden");

    const reason = (data.reason || "").trim() || "Aus Kurs entfernt";
    const courseName = (part as any).courses?.name ?? null;

    if (data.blocklist) {
      const email = (part.participant_email ?? "").trim().toLowerCase() || null;
      const child = (part.participant_name ?? "").trim().replace(/\s+/g, " ").toLowerCase() || null;
      if (email || child) {
        const { error: blErr } = await supabaseAdmin.from("booking_blocklist").insert({
          child_name_norm: child,
          child_dob: part.date_of_birth,
          email_norm: email,
          reason,
          source: "manual",
          active: true,
          created_by: context.userId,
        });
        // Nicht stillschweigend ohne Sperre weitermachen
        if (blErr)
          throw new Error(
            `Der Sperrlisteneintrag konnte nicht angelegt werden, der Teilnehmer wurde nicht entfernt: ${blErr.message}`,
          );
      }
    }

    const { error } = await supabaseAdmin.from("course_participants").delete().eq("id", part.id);
    if (error) throw new Error(error.message);

    // Zugehörige Kursanfrage nicht länger „angenommen“ mit diesem Kurs führen
    if (part.request_id) {
      await supabaseAdmin
        .from("course_requests")
        .update({ assigned_course_id: null, status: "contacted" })
        .eq("id", part.request_id)
        .eq("assigned_course_id", part.course_id);
    }

    // Frei gewordenen Platz gleich an die Warteliste vergeben
    try {
      const { allocateWaitlist } = await import("@/lib/waitlist.server");
      await allocateWaitlist(part.course_id as string);
    } catch (err) {
      console.error("waitlist allocation after removal failed", err);
    }

    let emailed = false;
    const recipient = (part.participant_email ?? "").trim();
    if (data.notify !== "none" && recipient) {
      const templateName =
        data.notify === "unpaid" ? "course-removal-unpaid" : "course-removal-agreed";
      try {
        const { queueTemplateEmail } = await import("@/lib/email-send.server");
        const res = await queueTemplateEmail({
          templateName,
          recipientEmail: recipient,
          templateData: {
            child_name: part.participant_name,
            course_name: courseName,
            note: (data.note || "").trim() || null,
          },
          idempotencyKey: `${templateName}-${part.id}`,
          senderUserId: context.userId,
          metadata: { course_id: part.course_id, participant_id: part.id },
        });
        emailed = res.queued;
      } catch (e) {
        console.error("course removal email failed", e);
      }
    }

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(context.supabase, context.userId, {
      action: "course_participant.removed",
      entity: "course_participants",
      entity_id: part.id,
      metadata: {
        course_id: part.course_id,
        name: part.participant_name,
        paid: part.paid,
        reason,
        blocklisted: data.blocklist,
        notify: data.notify,
        emailed,
      },
    });

    return { ok: true as const, blocklisted: data.blocklist, emailed };
  });

const cancelSchema = z.object({
  participantId: z.string().uuid(),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

/**
 * Absage einer Buchung durch die Familie (Teilnehmerliste, Status „Abgesagt“): hält Zeitpunkt und Grund
 * fest, damit die Absage in der Anfrageliste (Reiter „Absagen“) und im Sperrvorschlag mitzählt, und gibt
 * den Platz an die Warteliste frei.
 */
export const cancelCourseParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cancelSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!isStaff) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: part } = await supabaseAdmin
      .from("course_participants")
      .select("id,course_id,status,internal_notes")
      .eq("id", data.participantId)
      .maybeSingle();
    if (!part) throw new Error("Teilnehmer nicht gefunden");
    if (part.status === "cancelled") throw new Error("Diese Buchung ist bereits abgesagt.");

    const reason = (data.reason || "").trim() || null;
    const { formatDateTimeBerlin } = await import("@/lib/format");
    const now = new Date().toISOString();
    const line = `[${formatDateTimeBerlin(now)}] Absage erfasst${reason ? ` – Grund: ${reason}` : ""}.`;
    const { error } = await supabaseAdmin
      .from("course_participants")
      .update({
        status: "cancelled",
        cancelled_at: now,
        cancel_reason: reason,
        internal_notes: [part.internal_notes, line].filter(Boolean).join("\n"),
      } as never)
      .eq("id", part.id);
    if (error) throw new Error(error.message);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(context.supabase, context.userId, {
      action: "course.participant.cancelled",
      entity: "course_participants",
      entity_id: part.id,
      metadata: { course_id: part.course_id, reason },
    });

    // Frei gewordenen Platz gleich an die Warteliste vergeben
    try {
      const { allocateWaitlist } = await import("@/lib/waitlist.server");
      await allocateWaitlist(part.course_id as string);
    } catch (err) {
      console.error("waitlist allocation after cancellation failed", err);
    }
    return { ok: true };
  });
