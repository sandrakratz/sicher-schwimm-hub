// Server-only: Überführt einen Wartelisteneintrag in eine verbindliche Buchung
// (Teilnehmerliste, Buchungsdatum, Zahlungsdetails) und verschickt die
// Buchungsbestätigung an die Eltern sowie eine interne Kopie.

const SITE_BASE_URL = "https://sicher-schwimmen.com";

export type BookingAddress = { street?: string | null; zip?: string | null; city?: string | null };

export type BookingResult = {
  courseName: string;
  immediatePayment: boolean;
  paymentDueDate: string;
  documentNo: string | null;
  priceAmount: number | null;
};

const REFUSED_MESSAGES = {
  duplicate: "Für dieses Kind liegt bereits eine Buchung für diesen Kurs vor.",
  offer_not_valid: "Das Angebot ist nicht mehr gültig oder wurde bereits angenommen.",
  full: "Der Kurs ist inzwischen ausgebucht.",
  course_not_found: "Kurs nicht gefunden",
} as const;

/** Die Buchung wurde von der Datenbankfunktion abgelehnt (Duplikat, Angebot ungültig, voll …). */
export class BookingRefused extends Error {
  constructor(public reason: keyof typeof REFUSED_MESSAGES) {
    super(REFUSED_MESSAGES[reason]);
  }
}

/**
 * Die Anmerkungen eines Wartelisteneintrags beginnen immer mit dem Schwimmlevel
 * („Schwimmlevel: …“ bzw. „Schwimmniveau: …“). Das ist keine Gesundheitsangabe:
 * getrennt in Level und übrigen Freitext.
 */
function splitWaitlistNotes(notes: string | null | undefined): {
  swimmingLevel: string | null;
  rest: string | null;
} {
  let swimmingLevel: string | null = null;
  const rest: string[] = [];
  for (const line of (notes ?? "").split(/\r?\n/)) {
    if (/^\s*Wunschtage?:/i.test(line)) continue; // strukturierte Angabe, keine Freitext-Anmerkung
    const m = line.match(/^\s*Schwimm(?:level|niveau):\s*(.*)$/i);
    if (m && swimmingLevel === null) swimmingLevel = m[1].trim() || null;
    else if (line.trim()) rest.push(line.trim());
  }
  return { swimmingLevel, rest: rest.length ? rest.join("\n") : null };
}

/**
 * Bucht einen Wartelisteneintrag verbindlich in einen Kurs.
 * `source` steuert nur die Notiz/Beschriftung in Anfrage und interner E-Mail.
 */
export async function bookWaitlistEntry(
  entry: any,
  courseId: string,
  address: BookingAddress,
  source: "parent" | "admin" = "parent",
): Promise<BookingResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: course } = await supabaseAdmin
    .from("courses")
    .select("*, course_programs(*)")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) throw new Error("Kurs nicht gefunden");
  const program = (course as any).course_programs ?? null;

  // Zusage der Eltern nur für Kurse, die noch laufen: abgesagte/archivierte Kurse sind nicht mehr buchbar.
  // (Der Vorstand darf auch hier direkt buchen.)
  if (source === "parent" && (course.archived_at || course.status === "completed")) {
    throw new BookingRefused("offer_not_valid");
  }

  // Mitgliedschaft kann seit dem Eintrag/Angebot hinzugekommen sein
  const { refreshWaitlistMember } = await import("@/lib/waitlist.server");
  await refreshWaitlistMember(entry);

  const price =
    entry.is_member === true
      ? (course.price_member ?? program?.price_member ?? null)
      : (course.price_non_member ?? program?.price_non_member ?? null);

  const issuedAt = new Date().toISOString();

  const { paymentTerms } = await import("@/lib/payment-status");
  const dueDays = course.payment_due_days ?? program?.payment_due_days ?? 14;
  const terms = paymentTerms({
    bookedAt: issuedAt,
    startsOn: course.starts_on,
    paymentDueDays: dueDays,
  });
  const paymentMethod = terms.immediate ? "immediate" : "transfer";
  const paymentDueDate = terms.dueDateIso;

  const label =
    source === "admin" ? "Direkt aus der Warteliste gebucht" : "Zusage über die Warteliste";

  // Platz atomar buchen (Duplikat-/Angebotsprüfung, Belegnummer und Einlösen des Angebots in einer Transaktion)
  const { newPushToken } = await import("@/lib/push.server");
  const pushToken = newPushToken();
  const { bookSeat } = await import("@/lib/booking-seat.server");
  const seat = await bookSeat({
    courseId: course.id,
    entryId: entry.id,
    source: source === "admin" ? "admin" : "parent",
    participant: {
      participant_name: entry.child_name,
      participant_email: entry.parent_email,
      participant_phone: entry.parent_phone,
      payer_street: address.street || null,
      payer_zip: address.zip || null,
      payer_city: address.city || null,
      date_of_birth: entry.child_dob,
      notes: entry.notes,
      is_member: entry.is_member,
      price_amount: price,
      online_booking: source === "parent",
      payment_method: paymentMethod,
      payment_due_date: paymentDueDate,
      push_token: pushToken,
      document_issued_at: issuedAt,
    },
  });
  if (seat.result !== "booked") throw new BookingRefused(seat.result);
  const documentNo = seat.documentNo;

  const { swimmingLevel, rest: freeText } = splitWaitlistNotes(entry.notes);

  let requestId = entry.request_id as string | null;
  if (!requestId) {
    const { data: request } = await supabaseAdmin
      .from("course_requests")
      .insert({
        parent_name: entry.parent_name,
        parent_email: entry.parent_email,
        parent_phone: entry.parent_phone,
        child_name: entry.child_name,
        child_dob: entry.child_dob,
        desired_course: program?.name ?? course.name,
        swimming_level: swimmingLevel,
        health_info: freeText,
        gdpr_consent: true,
        contact_permission: true,
        status: "accepted",
        assigned_course_id: course.id,
        admin_notes: label,
      })
      .select("id")
      .maybeSingle();
    requestId = request?.id ?? null;
  } else {
    await supabaseAdmin
      .from("course_requests")
      .update({ status: "accepted", assigned_course_id: course.id })
      .eq("id", requestId);
  }

  // Teilnehmer und Wartelisteneintrag mit der Anfrage verknüpfen
  await supabaseAdmin
    .from("course_participants")
    .update({ request_id: requestId })
    .eq("id", seat.participantId);
  await supabaseAdmin.from("waitlist_entries").update({ request_id: requestId }).eq("id", entry.id);

  // Ab hier ist der Platz gebucht: scheitert ein Mailversand, soll die Buchung nicht als Fehler erscheinen
  // (sonst probieren Eltern es erneut und erhalten „bereits angenommen“). Die Mails stehen im Sendeprotokoll.
  const { queueTemplateEmail } = await import("@/lib/email-send.server");
  const safeMail = async (label: string, send: () => Promise<unknown>) => {
    try {
      await send();
    } catch (err) {
      console.error(`booking mail failed (${label})`, err);
    }
  };
  const { loadCourseSessionsForMail, courseIcsUrl } = await import(
    "@/lib/course-session-mail.server"
  );
  const mailSessions = await loadCourseSessionsForMail(course.id, course.schedule).catch(() => []);
  await safeMail("booking-confirmation", () =>
    queueTemplateEmail({
      templateName: "course-booking-confirmation",
      recipientEmail: entry.parent_email,
      idempotencyKey: `waitlist-accept-${entry.id}`,
      templateData: {
        parent_name: entry.parent_name,
        payer_street: address.street || "",
        payer_zip: address.zip || "",
        payer_city: address.city || "",
        child_name: entry.child_name,
        program_name: program?.name ?? course.name,
        course_name: course.name,
        course_location: course.location ?? program?.location,
        course_schedule: course.schedule,
        course_starts_on: course.starts_on,
        course_ends_on: course.ends_on,
        course_description: program?.description ?? course.description,
        course_info: (course as any).course_info ?? (program as any)?.course_info ?? null,
        sessions: mailSessions,
        ics_url: mailSessions.length ? courseIcsUrl(course.id) : null,
        unit_count: course.unit_count ?? null,
        waitlist: false,
        is_member: entry.is_member,
        price_amount: price,
        payment_due_days: dueDays,
        payment_method: paymentMethod,
        payment_due_date: paymentDueDate,
        document_no: documentNo ?? undefined,
        issued_at: issuedAt,
        site_base_url: SITE_BASE_URL,
        push_url: `${SITE_BASE_URL}/mitteilungen?token=${pushToken}`,
      },
      metadata: { waitlist_entry_id: entry.id, course_id: course.id },
    }),
  );

  await safeMail("internal-copy", () =>
    queueTemplateEmail({
      templateName: "course-request",
      idempotencyKey: `waitlist-accept-admin-${entry.id}`,
      templateData: {
        parent_name: entry.parent_name,
        parent_email: entry.parent_email,
        parent_phone: entry.parent_phone || "",
        child_name: entry.child_name,
        child_dob: entry.child_dob || "",
        desired_course: `${program?.name ?? course.name} – ${course.name}`,
        swimming_level: swimmingLevel ?? undefined,
        has_health_info: Boolean(freeText),
        message: `${label} – Platz verbindlich gebucht`,
        submitted_at: issuedAt,
        created_at: issuedAt,
        program_name: program?.name ?? course.name,
        course_name: course.name,
        course_starts_on: course.starts_on,
        course_ends_on: course.ends_on,
        course_schedule: course.schedule,
        course_location: course.location ?? program?.location ?? null,
        booking_status: "Warteliste – verbindlich gebucht",
      },
    }),
  );

  return {
    courseName: course.name,
    immediatePayment: terms.immediate,
    paymentDueDate,
    documentNo,
    priceAmount: price,
  };
}
