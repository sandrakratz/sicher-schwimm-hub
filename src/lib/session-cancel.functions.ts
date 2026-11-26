import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/auth-guards.server";

const cancelSchema = z.object({
  sessionId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
  /** Text an die Eltern (E-Mail + Handy-Mitteilung); leer = Eltern nicht informieren */
  parentMessage: z.string().trim().max(4000).optional().or(z.literal("")),
  notifyTrainers: z.boolean(),
});

/**
 * „Termin fällt aus“: protokolliert den Ausfall (course_session_cancellations), nimmt den Termin aus
 * dem Plan und informiert auf Wunsch Eltern und eingeteilte Trainer:innen. Nur ohne erfasste
 * Anwesenheit – die ist Versicherungs- und Abrechnungsnachweis.
 */
export const cancelCourseSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cancelSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- neue Tabelle fehlt in den generierten Typen
    const db = supabaseAdmin as any;

    const { data: s } = await db
      .from("course_sessions")
      .select(
        "id,course_id,session_index,session_date,start_time,end_time,assigned_trainer_id,courses(name,trainer_id)",
      )
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!s) throw new Error("Termin nicht gefunden.");

    const [kids, trainerAtt] = await Promise.all([
      db
        .from("course_attendance")
        .select("id", { count: "exact", head: true })
        .eq("session_id", s.id),
      db
        .from("trainer_session_attendance")
        .select("id", { count: "exact", head: true })
        .eq("session_id", s.id),
    ]);
    if ((kids.count ?? 0) > 0 || (trainerAtt.count ?? 0) > 0)
      throw new Error(
        "Zu diesem Termin ist schon Anwesenheit erfasst – er hat also stattgefunden und kann nicht als ausgefallen eingetragen werden.",
      );

    // Eingeteilte Trainer:innen vor dem Herausnehmen merken (Einteilungen gehen mit dem Termin)
    const { data: asg } = await db
      .from("course_session_assignments")
      .select("trainer_id")
      .eq("session_id", s.id);
    const trainerIds = [
      ...new Set<string>(
        [
          ...(asg ?? []).map((a: { trainer_id: string }) => a.trainer_id),
          s.assigned_trainer_id,
          s.courses?.trainer_id,
        ].filter(Boolean),
      ),
    ];

    const { formatDateBerlin } = await import("@/lib/format");
    const courseName: string = s.courses?.name ?? "Kurs";
    const when = `${formatDateBerlin(s.session_date)}${s.start_time ? `, ${String(s.start_time).slice(0, 5)} Uhr` : ""}`;

    // Erst protokollieren, dann herausnehmen: ein Ausfall darf nie spurlos verschwinden
    const { data: log, error: logErr } = await db
      .from("course_session_cancellations")
      .insert({
        course_id: s.course_id,
        session_index: s.session_index,
        session_date: s.session_date,
        start_time: s.start_time,
        end_time: s.end_time,
        reason: data.reason,
        cancelled_by: context.userId,
      })
      .select("id")
      .single();
    if (logErr) throw new Error(`Ausfall konnte nicht protokolliert werden: ${logErr.message}`);

    const { error: delErr } = await db.from("course_sessions").delete().eq("id", s.id);
    if (delErr) {
      await db.from("course_session_cancellations").delete().eq("id", log.id);
      throw new Error(
        delErr.message.includes("trainer_payout_items")
          ? "Dieser Termin ist schon in einer Übungsleiter-Auszahlung abgerechnet und kann nicht als ausgefallen eingetragen werden."
          : delErr.message,
      );
    }

    // Eltern informieren (E-Mail + Handy-Mitteilung), gleicher Weg wie die Eilnachricht
    let parents = 0;
    const msg = (data.parentMessage ?? "").trim();
    if (msg) {
      try {
        const { sendCourseBroadcast } = await import("@/lib/course-broadcast.server");
        const r = await sendCourseBroadcast({
          courseId: s.course_id,
          subject: `${courseName}: Termin am ${formatDateBerlin(s.session_date)} fällt aus`,
          message: msg,
          senderUserId: context.userId,
          key: `ausfall-${s.id}`,
        });
        parents = r.sent;
      } catch (e) {
        console.error("[termin-faellt-aus] Elternmail fehlgeschlagen", e);
      }
    }

    // Trainer:innen informieren
    let trainers = 0;
    if (data.notifyTrainers && trainerIds.length) {
      const { data: profs } = await db
        .from("profiles")
        .select("id,first_name,email")
        .in("id", trainerIds);
      const { queueTemplateEmail } = await import("@/lib/email-send.server");
      for (const p of profs ?? []) {
        if (!p.email) continue;
        try {
          const res = await queueTemplateEmail({
            templateName: "dienstplan-trainer",
            recipientEmail: p.email,
            idempotencyKey: `ausfall-${s.id}-${p.id}`,
            senderUserId: context.userId,
            templateData: {
              name: p.first_name ?? undefined,
              subject: `Termin fällt aus: ${courseName}, ${formatDateBerlin(s.session_date)}`,
              heading: "Termin fällt aus",
              intro: "Dieser Termin findet nicht statt. Dein Einsatz dafür entfällt.",
              sections: [{ title: courseName, items: [when] }],
              note: `Grund: ${data.reason}`,
            },
          });
          if (res.queued) trainers++;
        } catch (e) {
          console.error("[termin-faellt-aus] Trainermail fehlgeschlagen", e);
        }
      }
    }

    await db
      .from("course_session_cancellations")
      .update({ parents_notified: parents, trainers_notified: trainers })
      .eq("id", log.id);
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(null, context.userId, {
      action: "course.session.cancelled",
      entity: "courses",
      entity_id: s.course_id,
      metadata: { session_date: s.session_date, reason: data.reason, parents, trainers },
    });
    return { parents, trainers, courseId: s.course_id as string };
  });

export type SessionCancellation = {
  id: string;
  session_index: number | null;
  session_date: string;
  start_time: string | null;
  reason: string;
  cancelled_at: string;
  parents_notified: number;
  trainers_notified: number;
};
