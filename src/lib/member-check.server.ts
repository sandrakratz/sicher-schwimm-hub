/* eslint-disable @typescript-eslint/no-explicit-any -- gleiche Schreibweise wie die übrigen Verwaltungsfunktionen (Supabase-Kontext, Relationen) */
// Server-only: Prüfung der Angabe "Mitglied" bei Buchungen.
// Solange member_check = 'pending' ist, gehen keine Zahlungsmails an die Person (siehe
// payment-check-reminder und sendPaymentReminders). Die Entscheidung der Verwaltung setzt Preis und
// Zahlungsziel neu und verschickt dann die Kursbestätigung mit Zahlungsaufforderung.

import { priceFor } from "@/lib/member-claim";
import { isAdultProgram } from "@/lib/adult-course";

const SITE_BASE_URL = "https://sicher-schwimmen.com";

export async function markMemberCheckPending(participantId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabaseAdmin
      .from("course_participants")
      .update({ member_check: "pending" })
      .eq("id", participantId);
    if (!error) return;
    console.error("member_check pending konnte nicht gesetzt werden", participantId, error.message);
  }
}

export type MemberCheckDecision = "confirm" | "reject";

/**
 * Entscheidung der Verwaltung: Mitgliedschaft bestätigt (Mitgliedspreis) oder nicht bestätigt (Normalpreis).
 * Danach geht die Kursbestätigung mit Zahlungsaufforderung raus; das Zahlungsziel beginnt jetzt.
 */
export async function applyMemberCheck(
  participantId: string,
  decision: MemberCheckDecision,
  userId: string | null = null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: p, error } = await supabaseAdmin
    .from("course_participants")
    .select(
      "id,status,participant_name,participant_email,payer_street,payer_zip,payer_city,document_no,document_issued_at,push_token,member_check,request_id,course_id,courses!course_participants_course_id_fkey(*, course_programs(*))",
    )
    .eq("id", participantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) throw new Error("Anmeldung nicht gefunden.");
  if ((p as any).member_check !== "pending") {
    throw new Error("Diese Anmeldung ist nicht mehr zur Prüfung vorgemerkt.");
  }
  if (p.status !== "confirmed")
    throw new Error("Nur bestätigte Anmeldungen können freigegeben werden.");
  const course = (p as any).courses;
  const program = course?.course_programs ?? null;
  if (!course) throw new Error("Kurs nicht gefunden.");

  const isMember = decision === "confirm";
  const price = priceFor(isMember, {
    member: course.price_member ?? program?.price_member ?? null,
    nonMember: course.price_non_member ?? program?.price_non_member ?? null,
  });

  // Zahlungsziel beginnt mit der Freigabe
  const now = new Date().toISOString();
  const { paymentTerms } = await import("@/lib/payment-status");
  const dueDays = course.payment_due_days ?? program?.payment_due_days ?? 14;
  const terms = paymentTerms({
    bookedAt: now,
    startsOn: course.starts_on,
    paymentDueDays: dueDays,
  });

  const { error: upErr } = await supabaseAdmin
    .from("course_participants")
    .update({
      is_member: isMember,
      price_amount: price,
      member_check: isMember ? "verified" : "rejected",
      // gleicher Vermerk wie das Häkchen "Mitgliedschaft bestätigt (Buchhaltung)" in der Teilnehmerbearbeitung
      ...(isMember
        ? { member_confirmed: true, member_confirmed_at: now, member_confirmed_by: userId }
        : {}),
      payment_method: terms.immediate ? "immediate" : "transfer",
      payment_due_date: terms.dueDateIso,
    })
    .eq("id", participantId)
    .eq("member_check", "pending");
  if (upErr) throw new Error(upErr.message);

  // Zahler:in aus der Anfrage (bei Kindern), sonst die teilnehmende Person selbst
  let payerName: string = p.participant_name ?? "";
  if (p.request_id) {
    const { data: req } = await supabaseAdmin
      .from("course_requests")
      .select("parent_name")
      .eq("id", p.request_id)
      .maybeSingle();
    if (req?.parent_name) payerName = req.parent_name;
  }

  const email = (p.participant_email || "").trim();
  let mailSent = false;
  if (email) {
    const { queueTemplateEmail } = await import("@/lib/email-send.server");
    const { loadCourseSessionsForMail, courseIcsUrl } =
      await import("@/lib/course-session-mail.server");
    const sessions = await loadCourseSessionsForMail(course.id, course.schedule).catch(() => []);
    const res = await queueTemplateEmail({
      templateName: "course-booking-confirmation",
      recipientEmail: email,
      idempotencyKey: `member-check-${participantId}-${decision}`,
      templateData: {
        parent_name: payerName,
        payer_street: p.payer_street,
        payer_zip: p.payer_zip,
        payer_city: p.payer_city,
        child_name: p.participant_name,
        program_name: program?.name ?? course.name,
        course_name: course.name,
        course_location: course.location ?? program?.location,
        course_schedule: course.schedule,
        course_starts_on: course.starts_on,
        course_ends_on: course.ends_on,
        course_description: program?.description ?? course.description,
        course_info: course.course_info ?? program?.course_info ?? null,
        sessions,
        ics_url: sessions.length ? courseIcsUrl(course.id) : null,
        unit_count: course.unit_count ?? null,
        waitlist: false,
        member_rejected: !isMember,
        adult: program ? isAdultProgram(program) : false,
        is_member: isMember,
        price_amount: price,
        payment_due_days: dueDays,
        payment_method: terms.immediate ? "immediate" : "transfer",
        payment_due_date: terms.dueDateIso,
        document_no: p.document_no ?? undefined,
        issued_at: p.document_issued_at ?? now,
        site_base_url: SITE_BASE_URL,
        push_url: p.push_token ? `${SITE_BASE_URL}/mitteilungen?token=${p.push_token}` : undefined,
      },
      metadata: { participant_id: participantId, member_check: decision },
    });
    mailSent = Boolean(res.queued);
  }

  return { ok: true as const, isMember, price, mailSent, hasEmail: Boolean(email) };
}
