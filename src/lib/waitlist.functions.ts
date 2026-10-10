import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { todayBerlinIso } from "@/lib/format";
import { fetchAll, fetchIn } from "@/lib/fetch-all";
import { escapeLike } from "@/lib/like";
import type { Database } from "@/integrations/supabase/types";

type WaitlistRow = Database["public"]["Tables"]["waitlist_entries"]["Row"];
type BookedPart = Pick<
  Database["public"]["Tables"]["course_participants"]["Row"],
  | "id"
  | "course_id"
  | "request_id"
  | "participant_email"
  | "participant_name"
  | "paid"
  | "paid_at"
  | "price_amount"
  | "payment_method"
  | "payment_due_date"
  | "status"
  | "created_at"
>;

const SITE_BASE_URL = "https://sicher-schwimmen.com";

const joinSchema = z.object({
  programId: z.string().uuid().optional().nullable(),
  courseId: z.string().uuid().optional().nullable(),
  parentName: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .refine((v) => v.split(/\s+/).length >= 2, "Vor- und Nachname erforderlich"),
  parentEmail: z.string().trim().email().max(200),
  parentPhone: z.string().trim().min(5).max(60),
  childName: z.string().trim().min(2).max(120),
  childDob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  swimmingLevel: z.string().trim().min(1).max(200),
  isMember: z.boolean(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  gdprConsent: z.literal(true),
  contactPermission: z.literal(true),
  website: z.string().max(0).optional(),
});

/** Öffentliche Eintragung auf die Warteliste (ohne Login). */
export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => joinSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website) return { ok: true as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isBlocked, normalizeEmail } = await import("@/lib/blocklist.server");
    const emailNorm = normalizeEmail(data.parentEmail);

    // Sperrliste prüfen
    if (
      await isBlocked({
        email: data.parentEmail,
        childName: data.childName,
        childDob: data.childDob || null,
      })
    ) {
      return { ok: false as const, blocked: true as const };
    }

    // Doppeleintrag vermeiden
    const { data: existing } = await supabaseAdmin
      .from("waitlist_entries")
      .select("id")
      .ilike("parent_email", escapeLike(emailNorm))
      .ilike("child_name", escapeLike(data.childName.trim()))
      .in("status", ["waiting", "offered"])
      .limit(1)
      .maybeSingle();
    if (existing) return { ok: true as const, duplicate: true as const };

    const { data: mem } = await supabaseAdmin
      .from("memberships")
      .select("status")
      .ilike("email", escapeLike(emailNorm))
      .limit(1)
      .maybeSingle();

    let programId = data.programId ?? null;
    let courseName: string | null = null;
    if (data.courseId) {
      const { data: course } = await supabaseAdmin
        .from("courses")
        .select("id,name,program_id")
        .eq("id", data.courseId)
        .maybeSingle();
      if (course) {
        courseName = course.name;
        programId = programId ?? course.program_id;
      }
    }
    let programName: string | null = null;
    if (programId) {
      const { data: prog } = await supabaseAdmin
        .from("course_programs")
        .select("name, waitlist_open")
        .eq("id", programId)
        .maybeSingle();
      if (prog && (prog as any).waitlist_open === false) {
        throw new Error(
          "Für dieses Kursangebot ist die Warteliste derzeit geschlossen. Bitte wählen Sie ein anderes Angebot.",
        );
      }
      programName = prog?.name ?? null;
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("waitlist_entries")
      .insert({
        program_id: programId,
        course_id: data.courseId ?? null,
        child_name: data.childName,
        child_dob: data.childDob || null,
        parent_name: data.parentName,
        parent_email: data.parentEmail,
        parent_phone: data.parentPhone || null,
        is_member: mem ? mem.status === "active" : data.isMember,
        notes: [`Schwimmlevel: ${data.swimmingLevel}`, data.notes || null]
          .filter(Boolean)
          .join("\n"),
        gdpr_consent: true,
        status: "waiting",
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    const { queueTemplateEmail } = await import("@/lib/email-send.server");
    await queueTemplateEmail({
      templateName: "waitlist-signup",
      recipientEmail: data.parentEmail,
      idempotencyKey: `waitlist-signup-${inserted?.id}`,
      templateData: {
        parent_name: data.parentName,
        child_name: data.childName,
        program_name: programName,
        course_name: courseName,
      },
      metadata: { waitlist_entry_id: inserted?.id },
    });

    await queueTemplateEmail({
      templateName: "course-request",
      idempotencyKey: `waitlist-admin-${inserted?.id}`,
      templateData: {
        parent_name: data.parentName,
        parent_email: data.parentEmail,
        parent_phone: data.parentPhone || "",
        child_name: data.childName,
        child_dob: data.childDob || "",
        desired_course: [programName, courseName].filter(Boolean).join(" – ") || "Ohne Angabe",
        swimming_level: data.swimmingLevel,
        // Anmerkungen können Gesundheitsangaben enthalten: nur Hinweis, Text steht im Admin-Bereich
        has_health_info: Boolean(data.notes),
        privacy_accepted: true,
        message: `Neue Eintragung auf der Warteliste über die Webseite (Mitglied: ${data.isMember ? "ja" : "nein"})`,
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        program_name: programName,
        course_name: courseName,
        booking_status: "Warteliste",
      },
    });

    // Falls sofort ein Platz frei ist, direkt anbieten
    try {
      const { allocateWaitlist } = await import("@/lib/waitlist.server");
      await allocateWaitlist(data.courseId ?? null);
    } catch (err) {
      console.error("waitlist allocation after signup failed", err);
    }

    return { ok: true as const };
  });

/** Lädt ein Platzangebot anhand des Tokens (öffentliche Antwortseite). */
export const getWaitlistOffer = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) =>
    z.object({ token: z.string().min(10).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: entry } = await supabaseAdmin
      .from("waitlist_entries")
      .select(
        "*, courses:offer_course_id(name,starts_on,ends_on,schedule,location,price_member,price_non_member)",
      )
      .eq("offer_token", data.token)
      .maybeSingle();
    if (!entry) return { found: false as const };

    const course = (entry as any).courses ?? null;
    const expired = entry.offer_expires_at
      ? new Date(entry.offer_expires_at).getTime() < Date.now()
      : true;
    return {
      found: true as const,
      status: entry.status as string,
      expired,
      childName: entry.child_name,
      needsDob: !entry.child_dob,
      parentName: entry.parent_name,
      expiresAt: entry.offer_expires_at,
      course: course
        ? {
            name: course.name as string,
            startsOn: course.starts_on as string | null,
            endsOn: course.ends_on as string | null,
            schedule: course.schedule as string | null,
            location: course.location as string | null,
            price: (entry.is_member === true ? course.price_member : course.price_non_member) as
              number | null,
          }
        : null,
    };
  });

const respondSchema = z.object({
  token: z.string().min(10).max(200),
  action: z.enum(["accept", "decline"]),
  stay: z.boolean().optional(),
  availableFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  reason: z.string().trim().max(500).nullable().optional(),
  street: z.string().trim().max(160).optional().or(z.literal("")),
  zip: z.string().trim().max(12).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  childDob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
});

/** Zusage oder Absage zu einem Platzangebot. */
export const respondWaitlistOffer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => respondSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: entry } = await supabaseAdmin
      .from("waitlist_entries")
      .select("*")
      .eq("offer_token", data.token)
      .maybeSingle();
    if (!entry || entry.status !== "offered")
      return { ok: false as const, reason: "not_found" as const };
    if (entry.offer_expires_at && new Date(entry.offer_expires_at).getTime() < Date.now()) {
      return { ok: false as const, reason: "expired" as const };
    }

    if (data.action === "decline") {
      const { data: c } = entry.offer_course_id
        ? await supabaseAdmin
            .from("courses")
            .select("name")
            .eq("id", entry.offer_course_id)
            .maybeSingle()
        : { data: null };
      const { registerDecline, allocateWaitlist } = await import("@/lib/waitlist.server");
      const res = await registerDecline(entry, {
        stay: data.stay !== false,
        availableFrom: data.availableFrom ?? null,
        reason: data.reason || null,
        courseName: c?.name ?? null,
      });
      try {
        await allocateWaitlist(entry.offer_course_id);
      } catch (err) {
        console.error("allocate after decline failed", err);
      }
      return {
        ok: true as const,
        action: "decline" as const,
        deactivated: res.deactivated,
        count: res.count,
      };
    }

    if (!data.street || !data.zip || !data.city)
      return { ok: false as const, reason: "address_required" as const };

    // Ältere Wartelisteneinträge ohne Geburtsdatum: vor der Buchung nachfordern.
    let bookingEntry = entry;
    if (!entry.child_dob) {
      const dob = data.childDob;
      if (!dob || dob > todayBerlinIso()) {
        return { ok: false as const, reason: "dob_required" as const };
      }
      await supabaseAdmin.from("waitlist_entries").update({ child_dob: dob }).eq("id", entry.id);
      bookingEntry = { ...entry, child_dob: dob };
    }

    const { bookWaitlistEntry, BookingRefused } = await import("@/lib/waitlist-booking.server");
    let booking: Awaited<ReturnType<typeof bookWaitlistEntry>>;
    try {
      booking = await bookWaitlistEntry(
        bookingEntry,
        entry.offer_course_id!,
        { street: data.street, zip: data.zip, city: data.city },
        "parent",
      );
    } catch (err) {
      // Doppelklick / bereits gebucht / Angebot inzwischen ungültig
      if (err instanceof BookingRefused) {
        return {
          ok: false as const,
          reason: err.reason === "offer_not_valid" ? ("not_found" as const) : err.reason,
        };
      }
      throw err;
    }
    await supabaseAdmin.from("waitlist_entries").update({ decline_count: 0 }).eq("id", entry.id);

    return {
      ok: true as const,
      action: "accept" as const,
      courseName: booking.courseName,
      immediatePayment: booking.immediatePayment,
      paymentDueDate: booking.paymentDueDate,
    };
  });

/* ---------------------------- Verwaltung ---------------------------- */

async function assertStaff(context: any) {
  const { data: isStaff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (!isStaff) throw new Error("Forbidden");
}

export const listWaitlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Abgelaufene Platzangebote schließen, damit Plätze nicht hängen bleiben
    try {
      const { expireOffers } = await import("@/lib/waitlist.server");
      await expireOffers();
    } catch (err) {
      console.error("expireOffers failed", err);
    }

    // Einträge und Buchungen seitenweise laden: Supabase liefert pro Abfrage höchstens 1000 Zeilen, sonst
    // fehlten die neuesten Einträge bzw. der Zahlungsstatus würde still falsch angezeigt.
    const entries = await fetchAll<WaitlistRow>((f, t) =>
      supabaseAdmin
        .from("waitlist_entries")
        .select("*")
        .order("created_at", { ascending: true })
        .order("id")
        .range(f, t),
    );
    const [{ data: programs, error: programsError }, { data: courses }, { data: blocklist }] =
      await Promise.all([
        supabaseAdmin
          .from("course_programs")
          .select("id,name,slug,min_age_years")
          .order("sort_order"),
        supabaseAdmin
          .from("courses")
          .select("id,name,program_id,starts_on,max_participants,status,archived_at")
          .is("archived_at", null)
          .order("starts_on"),
        supabaseAdmin
          .from("booking_blocklist")
          .select("email_norm,child_name_norm,child_dob,reason")
          .eq("active", true),
      ]);
    if (programsError) {
      console.error("listWaitlist failed", programsError);
      throw new Error(`Wartelisten-Abfrage fehlgeschlagen: ${programsError.message}`);
    }

    // Originalanfrage (komplett) nachziehen
    const requestIds = entries.map((e) => e.request_id).filter((v): v is string => !!v);
    const requests = new Map<string, Record<string, string | number | boolean | null>>();
    if (requestIds.length) {
      const reqs = await fetchIn<Record<string, unknown> & { id: string }>(
        requestIds,
        (chunk, f, t) =>
          supabaseAdmin.from("course_requests").select("*").in("id", chunk).order("id").range(f, t),
      );
      for (const r of reqs) {
        const plain: Record<string, string | number | boolean | null> = {};
        for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
          plain[k] =
            v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean"
              ? (v as string | number | boolean | null)
              : JSON.stringify(v);
        }
        requests.set(r.id, plain);
      }
    }

    const courseIds = (courses ?? []).map((c) => c.id);
    const counts = new Map<string, number>();
    if (courseIds.length) {
      const parts = await fetchIn<{ course_id: string; status: string }>(courseIds, (chunk, f, t) =>
        supabaseAdmin
          .from("course_participants")
          .select("course_id,status")
          .in("course_id", chunk)
          .order("id")
          .range(f, t),
      );
      for (const p of parts) {
        if (p.status === "confirmed") counts.set(p.course_id, (counts.get(p.course_id) ?? 0) + 1);
      }
    }

    const norm = (v: string | null | undefined) =>
      (v ?? "").trim().replace(/\s+/g, " ").toLowerCase();

    // Zahlungsstatus der bereits gebuchten Plätze (über Anfrage-ID oder E-Mail + Kind)
    const bookedParts = await fetchAll<BookedPart>((f, t) =>
      supabaseAdmin
        .from("course_participants")
        .select(
          "id,course_id,request_id,participant_email,participant_name,paid,paid_at,price_amount,payment_method,payment_due_date,status,created_at",
        )
        .neq("status", "cancelled")
        .order("id")
        .range(f, t),
    );
    const partByRequest = new Map<string, BookedPart>();
    const partByPerson = new Map<string, BookedPart>();
    for (const p of bookedParts) {
      if (p.request_id) partByRequest.set(p.request_id, p);
      partByPerson.set(`${norm(p.participant_email)}|${norm(p.participant_name)}`, p);
    }
    const dupCount = new Map<string, number>();
    for (const e of entries) {
      if (!["waiting", "offered"].includes(e.status)) continue;
      const key = `${norm(e.parent_email)}|${norm(e.child_name)}`;
      dupCount.set(key, (dupCount.get(key) ?? 0) + 1);
    }

    // Absagen (Anfrageliste) und Stornierungen (gebuchte Plätze) je E-Mail bzw. Kind über ALLE
    // Einträge summieren, damit ein neuer Eintrag den Zähler nicht zurücksetzt.
    const { loadCancellations, buildDeclineStats } = await import("@/lib/decline-stats.server");
    const cancellationRows = await loadCancellations();
    const statsFor = buildDeclineStats(entries as never, cancellationRows, blocklist ?? []);
    const cancelCourseIds = [
      ...new Set(
        cancellationRows.flatMap((c) =>
          [c.course_id, c.transferred_to_course_id].filter((v): v is string => !!v),
        ),
      ),
    ];
    const cancelCourseNames = new Map<string, string>();
    if (cancelCourseIds.length) {
      const named = await fetchIn<{ id: string; name: string }>(cancelCourseIds, (chunk, f, t) =>
        supabaseAdmin.from("courses").select("id,name").in("id", chunk).order("id").range(f, t),
      );
      for (const c of named) cancelCourseNames.set(c.id, c.name);
    }
    const cancellations = cancellationRows
      .map((c) => {
        const st = statsFor(c.participant_email, c.participant_name);
        return {
          id: c.id,
          child_name: c.participant_name,
          parent_email: c.participant_email,
          course_name: cancelCourseNames.get(c.course_id) ?? "Kurs",
          moved_to: c.transferred_to_course_id
            ? (cancelCourseNames.get(c.transferred_to_course_id) ?? "anderer Kurs")
            : null,
          cancelled_at: c.transferred_at ?? c.cancelled_at,
          kind: c.transferred_to_course_id
            ? ("transfer" as const)
            : c.transferred_at
              ? ("waitlist" as const)
              : ("cancelled" as const),
          reason: c.transfer_reason ?? c.cancel_reason,
          declines_total: st.total,
          blocked: st.blocked,
          block_suggestion: st.suggest,
        };
      })
      .sort((a, b) => (b.cancelled_at ?? "").localeCompare(a.cancelled_at ?? ""));

    // Mitarbeitende (Vorstand/Verwaltung) für „Zuständig“ in der Anfrageliste
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "board"]);
    const staffIds = [...new Set((roleRows ?? []).map((r) => r.user_id))];
    const { data: staffProfiles } = staffIds.length
      ? await supabaseAdmin.from("profiles").select("first_name,last_name").in("id", staffIds)
      : { data: [] as Array<{ first_name: string | null; last_name: string | null }> };
    const staff = (staffProfiles ?? [])
      .map((p) => `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "de"));

    return {
      entries: entries.map((e) => {
        const req = e.request_id ? (requests.get(e.request_id) ?? null) : null;
        const emailNorm = norm(e.parent_email);
        const childNorm = norm(e.child_name);
        const stats = statsFor(e.parent_email, e.child_name, e.child_dob);
        const block = (blocklist ?? []).find(
          (b) =>
            (b.email_norm && b.email_norm === emailNorm) ||
            (b.child_name_norm &&
              b.child_name_norm === childNorm &&
              (!b.child_dob || b.child_dob === e.child_dob)),
        );
        const part =
          (e.request_id ? partByRequest.get(e.request_id) : undefined) ??
          partByPerson.get(`${emailNorm}|${childNorm}`) ??
          null;
        const today = todayBerlinIso();
        const paymentStatus = !part
          ? "none"
          : part.paid
            ? "paid"
            : part.payment_due_date && part.payment_due_date < today
              ? "overdue"
              : "open";
        return {
          ...e,
          desired_course: (req?.["desired_course"] as string | null) ?? null,
          request: req,
          blocked_reason: block?.reason ?? null,
          declines_total: stats.total,
          block_suggestion: stats.suggest,
          duplicate: (dupCount.get(`${emailNorm}|${childNorm}`) ?? 0) > 1,
          booking: part
            ? {
                course_id: part.course_id,
                paid: !!part.paid,
                paid_at: part.paid_at,
                price_amount: part.price_amount,
                payment_method: part.payment_method,
                payment_due_date: part.payment_due_date,
                booked_at: part.created_at,
              }
            : null,
          payment_status: paymentStatus as "none" | "open" | "overdue" | "paid",
        };
      }),

      cancellations,
      staff,
      programs: programs ?? [],
      courses: (courses ?? []).map((c) => {
        const nowIso = new Date().toISOString();
        const held = (entries ?? []).filter(
          (e) =>
            e.status === "offered" &&
            e.offer_course_id === c.id &&
            (!e.offer_expires_at || e.offer_expires_at >= nowIso),
        ).length;
        const confirmed = counts.get(c.id) ?? 0;
        return {
          ...c,
          confirmed,
          held,
          free:
            c.max_participants != null ? Math.max(0, c.max_participants - confirmed - held) : null,
        };
      }),
    };
  });

export const runWaitlistAllocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId?: string | null } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { allocateWaitlist } = await import("@/lib/waitlist.server");
    const result = await allocateWaitlist(data.courseId ?? null);
    return { offers: result.offers.length, expired: result.expired };
  });

export const offerWaitlistPlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { entryId: string; courseId: string }) =>
    z.object({ entryId: z.string().uuid(), courseId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: entry }, { data: course }] = await Promise.all([
      supabaseAdmin.from("waitlist_entries").select("*").eq("id", data.entryId).maybeSingle(),
      supabaseAdmin
        .from("courses")
        .select("*, course_programs(*)")
        .eq("id", data.courseId)
        .maybeSingle(),
    ]);
    if (!entry || !course) throw new Error("Eintrag oder Kurs nicht gefunden");
    if (entry.status !== "waiting") throw new Error("Für diesen Eintrag läuft bereits ein Angebot");
    if ((course as any).course_programs?.bookable === false) {
      throw new Error(
        "Dieses Kursangebot ist derzeit nicht buchbar – es können keine Plätze angeboten werden",
      );
    }

    const { offerPlaceManually, freeSlots } = await import("@/lib/waitlist.server");
    const free = await freeSlots(course.id, course.max_participants);
    if (free != null && free <= 0) throw new Error("In diesem Kurs ist kein Platz mehr frei");
    await offerPlaceManually(entry, course, (course as any).course_programs ?? null);
    return { ok: true };
  });

/**
 * Absage zu einem laufenden Platzangebot, die nicht über den Link kam (Telefon, E-Mail …).
 * Gibt den Platz frei, zählt als Absage und vergibt ihn an den nächsten Wartenden.
 */
export const recordWaitlistDecline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        entryId: z.string().uuid(),
        stay: z.boolean(),
        availableFrom: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional(),
        reason: z.string().trim().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: entry } = await supabaseAdmin
      .from("waitlist_entries")
      .select("*")
      .eq("id", data.entryId)
      .maybeSingle();
    if (!entry) throw new Error("Eintrag nicht gefunden");
    if (entry.status !== "offered") throw new Error("Für diesen Eintrag läuft kein Platzangebot");

    const { data: c } = entry.offer_course_id
      ? await supabaseAdmin
          .from("courses")
          .select("name")
          .eq("id", entry.offer_course_id)
          .maybeSingle()
      : { data: null };
    const { registerDecline, allocateWaitlist } = await import("@/lib/waitlist.server");
    const res = await registerDecline(entry, {
      stay: data.stay,
      availableFrom: data.availableFrom ?? null,
      reason: data.reason || null,
      courseName: c?.name ?? null,
    });

    let newOffers = 0;
    try {
      newOffers = (await allocateWaitlist(entry.offer_course_id)).offers.length;
    } catch (err) {
      console.error("allocate after manual decline failed", err);
    }

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(context.supabase, context.userId, {
      action: "waitlist.decline_recorded",
      entity: "waitlist_entries",
      entity_id: data.entryId,
      metadata: { stay: data.stay, deactivated: res.deactivated, count: res.count },
    });

    return { ok: true as const, deactivated: res.deactivated, count: res.count, newOffers };
  });

const updateSchema = z.object({
  entryId: z.string().uuid(),
  status: z.enum(["waiting", "removed", "declined"]).optional(),
  adminNotes: z.string().max(4000).nullable().optional(),
  appendNote: z.string().trim().max(2000).optional(),
  programId: z.string().uuid().nullable().optional(),
  childName: z.string().trim().min(1).max(120).optional(),
  childDob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  parentName: z.string().trim().min(1).max(120).optional(),
  parentEmail: z.string().trim().email().max(200).optional(),
  parentPhone: z.string().trim().max(60).nullable().optional(),
  isMember: z.boolean().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  blocklist: z.boolean().optional(),
  dismissBlockSuggestion: z.boolean().optional(),
  assignedTo: z.string().trim().max(120).nullable().optional(),
  followUpOn: z
    .string()
    .regex(/^d{4}-d{2}-d{2}$/)
    .nullable()
    .optional(),
  availableFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  declineCount: z.number().int().min(0).max(10).optional(),
  blocklistReason: z.string().trim().max(500).optional(),
});

export const updateWaitlistEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: entry } = await supabaseAdmin
      .from("waitlist_entries")
      .select("*")
      .eq("id", data.entryId)
      .maybeSingle();
    if (!entry) throw new Error("Eintrag nicht gefunden");

    const patch: Record<string, unknown> = {};
    if (data.status) {
      patch["status"] = data.status;
      patch["offer_token"] = null;
      patch["offer_expires_at"] = null;
      // Bei „Wartend“ bleibt der zuletzt angebotene Kurs als „bereits angeboten“ stehen,
      // damit die automatische Vergabe ihn nicht sofort erneut anbietet
      // (siehe allocateWaitlist). Ein bewusstes Neu-Angebot geht über offerWaitlistPlace.
      if (data.status !== "waiting") patch["offer_course_id"] = null;
    }
    if (data.status) {
      patch["followup_token"] = null;
      patch["followup_expires_at"] = null;
    }
    if (data.declineCount !== undefined) patch["decline_count"] = data.declineCount;
    if (data.assignedTo !== undefined) patch["assigned_to"] = data.assignedTo || null;
    if (data.followUpOn !== undefined) patch["follow_up_on"] = data.followUpOn;
    if (data.dismissBlockSuggestion) patch["block_review_dismissed_at"] = new Date().toISOString();
    if (data.adminNotes !== undefined) patch["admin_notes"] = data.adminNotes;
    if (data.appendNote) {
      const { formatDateTimeBerlin } = await import("@/lib/format");
      const stamp = formatDateTimeBerlin(new Date().toISOString());
      const prev = (patch["admin_notes"] as string | null) ?? entry.admin_notes ?? "";
      patch["admin_notes"] = `${prev ? `${prev}\n` : ""}[${stamp}] ${data.appendNote}`;
    }
    // Angebot zurückziehen / Absage nachtragen (Zurück auf wartend): Platz wird frei, die Familie wartet
    // frühestens bis zum nächsten Kurs – sonst bekäme sie sofort wieder ein Angebot und würde erneut Plätze blockieren.
    // Nicht bei einem Wechsel des Kursangebots (Fehlzuordnung) oder einem ausdrücklich gesetzten Datum.
    if (
      data.status === "waiting" &&
      ["offered", "declined", "expired"].includes(entry.status) &&
      data.programId === undefined &&
      data.availableFrom === undefined
    ) {
      const { earliestAfterOffer } = await import("@/lib/waitlist.server");
      const { formatDateBerlin, formatDateTimeBerlin } = await import("@/lib/format");
      const from = await earliestAfterOffer(entry, (entry.available_from as string | null) ?? null);
      patch["available_from"] = from;
      const prevNotes =
        (patch["admin_notes"] as string | null | undefined) ?? entry.admin_notes ?? "";
      const line = `[${formatDateTimeBerlin(new Date().toISOString())}] Zurück auf wartend – frühestens für Kurse ab ${from ? formatDateBerlin(from) : "sofort"}.`;
      patch["admin_notes"] = `${
        prevNotes
          ? `${prevNotes}
`
          : ""
      }${line}`;
    }
    if (data.programId !== undefined) {
      patch["program_id"] = data.programId;
      patch["course_id"] = null;
    }
    if (data.childName !== undefined) patch["child_name"] = data.childName;
    if (data.childDob !== undefined) patch["child_dob"] = data.childDob;
    if (data.parentName !== undefined) patch["parent_name"] = data.parentName;
    if (data.parentEmail !== undefined) patch["parent_email"] = data.parentEmail;
    if (data.parentPhone !== undefined) patch["parent_phone"] = data.parentPhone || null;
    if (data.isMember !== undefined) patch["is_member"] = data.isMember;
    if (data.notes !== undefined) patch["notes"] = data.notes;
    if (data.availableFrom !== undefined) patch["available_from"] = data.availableFrom;

    const { error } = await supabaseAdmin
      .from("waitlist_entries")
      .update(patch as never)
      .eq("id", data.entryId);
    if (error) throw new Error(error.message);

    if (data.blocklist) {
      const email = (entry.parent_email ?? "").trim().toLowerCase() || null;
      const child = (entry.child_name ?? "").trim().replace(/\s+/g, " ").toLowerCase() || null;
      const { error: blErr } = await supabaseAdmin.from("booking_blocklist").insert({
        child_name_norm: child,
        child_dob: entry.child_dob,
        email_norm: email,
        reason: data.blocklistReason || "Von der Warteliste abgemeldet",
        source: "manual",
        active: true,
        created_by: context.userId,
      });
      if (blErr)
        throw new Error(
          `Der Eintrag wurde geändert, aber der Sperrlisteneintrag konnte nicht angelegt werden: ${blErr.message}`,
        );
    }

    return { ok: true };
  });

/**
 * Übernimmt alte Kursanfragen mit Status „Warteliste“ einmalig in die neue
 * Warteliste – inklusive Wunschkurs (Textabgleich) und Notizen. Idempotent.
 */
export const migrateWaitingRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { matchProgram } = await import("@/lib/waitlist-age");

    const { loadActiveBlocklist, matchesBlocklist } = await import("@/lib/blocklist.server");
    const blocklist = await loadActiveBlocklist();

    const [{ data: requests }, { data: programs }, { data: existing }] = await Promise.all([
      supabaseAdmin
        .from("course_requests")
        .select("*")
        // Nur Anfragen, die ausdrücklich auf „Warteliste“ stehen. Neue Anfragen (u. a. Sperrlisten-Fälle
        // zur Einzelfallprüfung) werden nicht automatisch übernommen.
        .eq("status", "waiting_list")
        .is("assigned_course_id", null)
        .is("waitlist_archived_at", null)
        .order("created_at", { ascending: true }),
      supabaseAdmin.from("course_programs").select("id,name,slug").order("sort_order"),
      supabaseAdmin.from("waitlist_entries").select("id,request_id,parent_email,child_name"),
    ]);

    // Bereits in einen Kurs aufgenommene Anfragen nicht erneut auf die Warteliste holen
    const { data: participants } = await supabaseAdmin
      .from("course_participants")
      .select("request_id,participant_name,participant_email")
      .neq("status", "cancelled");

    const enrolledRequests = new Set(
      (participants ?? []).map((p) => p.request_id).filter(Boolean) as Array<string>,
    );
    const enrolledPersons = new Set(
      (participants ?? []).map(
        (p) =>
          `${(p.participant_email ?? "").toLowerCase().trim()}|${(p.participant_name ?? "").toLowerCase().trim()}`,
      ),
    );

    const byRequest = new Set(
      (existing ?? []).map((e) => e.request_id).filter(Boolean) as Array<string>,
    );
    const byPerson = new Set(
      (existing ?? []).map(
        (e) =>
          `${(e.parent_email ?? "").toLowerCase().trim()}|${(e.child_name ?? "").toLowerCase().trim()}`,
      ),
    );

    const rows: Array<Record<string, unknown>> = [];
    for (const r of requests ?? []) {
      if (byRequest.has(r.id)) continue;
      if (enrolledRequests.has(r.id)) continue;
      const key = `${(r.parent_email ?? "").toLowerCase().trim()}|${(r.child_name ?? "").toLowerCase().trim()}`;
      if (byPerson.has(key) || enrolledPersons.has(key)) continue;
      // Gesperrte Familien nie automatisch auf die Warteliste setzen – das entscheidet der Vorstand
      if (
        matchesBlocklist(blocklist, {
          email: r.parent_email,
          childName: r.child_name,
          childDob: r.child_dob,
        })
      )
        continue;
      byPerson.add(key);
      const prog = matchProgram(r.desired_course, programs ?? []);
      rows.push({
        program_id: prog?.id ?? null,
        request_id: r.id,
        child_name: r.child_name ?? "Unbekannt",
        child_dob: r.child_dob,
        parent_name: r.parent_name,
        parent_email: r.parent_email,
        parent_phone: r.parent_phone,
        notes:
          [r.message, r.health_info, r.swimming_level ? `Schwimmniveau: ${r.swimming_level}` : null]
            .filter(Boolean)
            .join("\n") || null,
        admin_notes: r.admin_notes,
        gdpr_consent: true,
        status: "waiting",
        created_at: r.created_at,
      });
    }

    if (rows.length) {
      const { error } = await supabaseAdmin.from("waitlist_entries").insert(rows as never);
      if (error) throw new Error(error.message);
    }
    return { migrated: rows.length };
  });

export const deleteWaitlistEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { entryId: string }) =>
    z.object({ entryId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Ursprungsanfrage markieren, damit der Eintrag nicht automatisch
    // erneut aus den alten Kursanfragen importiert wird.
    const { data: entry } = await supabaseAdmin
      .from("waitlist_entries")
      .select("request_id")
      .eq("id", data.entryId)
      .maybeSingle();
    if (entry?.request_id) {
      await supabaseAdmin
        .from("course_requests")
        .update({ waitlist_archived_at: new Date().toISOString() } as never)
        .eq("id", entry.request_id);
    }

    const { error } = await supabaseAdmin.from("waitlist_entries").delete().eq("id", data.entryId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Direkte, verbindliche Buchung aus der Verwaltung: erzeugt sofort den
 * Teilnehmereintrag mit Buchungsdatum und Zahlungsdetails und verschickt die
 * Buchungsbestätigung an die Eltern.
 */
export const bookWaitlistPlaceDirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        entryId: z.string().uuid(),
        courseId: z.string().uuid(),
        street: z.string().trim().max(160).optional(),
        zip: z.string().trim().max(12).optional(),
        city: z.string().trim().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: entry } = await supabaseAdmin
      .from("waitlist_entries")
      .select("*")
      .eq("id", data.entryId)
      .maybeSingle();
    if (!entry) throw new Error("Eintrag nicht gefunden");
    if (entry.status === "accepted") throw new Error("Dieser Eintrag ist bereits gebucht");

    const { bookWaitlistEntry } = await import("@/lib/waitlist-booking.server");
    const booking = await bookWaitlistEntry(
      entry,
      data.courseId,
      { street: data.street ?? null, zip: data.zip ?? null, city: data.city ?? null },
      "admin",
    );
    return { ok: true as const, ...booking };
  });

/* ------------------------- Rückfrage „Warteliste behalten?“ ------------------------- */

export const getWaitlistFollowup = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) =>
    z.object({ token: z.string().min(10).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: e } = await supabaseAdmin
      .from("waitlist_entries")
      .select("child_name,status,followup_expires_at,decline_count")
      .eq("followup_token", data.token)
      .maybeSingle();
    if (!e) return { found: false as const };
    const expired =
      !e.followup_expires_at || new Date(e.followup_expires_at).getTime() < Date.now();
    return {
      found: true as const,
      childName: e.child_name,
      expired,
      expiresAt: e.followup_expires_at,
      count: e.decline_count,
    };
  });

export const answerWaitlistFollowup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().min(10).max(200),
        stay: z.boolean(),
        availableFrom: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: e } = await supabaseAdmin
      .from("waitlist_entries")
      .select("*")
      .eq("followup_token", data.token)
      .maybeSingle();
    if (!e) return { ok: false as const, reason: "not_found" as const };
    if (!e.followup_expires_at || new Date(e.followup_expires_at).getTime() < Date.now())
      return { ok: false as const, reason: "expired" as const };
    const { answerFollowup } = await import("@/lib/waitlist.server");
    await answerFollowup(e, data.stay, data.availableFrom ?? null);
    return { ok: true as const };
  });

const blockSuggestionSchema = z.object({
  action: z.enum(["block", "dismiss"]),
  email: z.string().trim().max(200).nullable(),
  childName: z.string().trim().max(120).nullable(),
  reason: z.string().trim().max(500).optional(),
});

/** Sperrvorschlag bearbeiten (für Familien, die nur Stornierungen, aber keinen Wartelisteneintrag haben). */
export const resolveBlockSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => blockSuggestionSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const norm = (v: string | null | undefined) =>
      (v ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    const email = norm(data.email);
    const child = norm(data.childName);
    if (!email && !child) throw new Error("E-Mail oder Kindname fehlt.");

    if (data.action === "block") {
      const { error } = await supabaseAdmin.from("booking_blocklist").insert({
        child_name_norm: child || null,
        child_dob: null,
        email_norm: email || null,
        reason: data.reason || "Wiederholte Absagen/Stornierungen",
        source: "manual",
        active: true,
        created_by: context.userId,
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    // „Ignorieren“: alle passenden Stornierungen und Wartelisteneinträge markieren
    const stamp = new Date().toISOString();
    const matches = (e: string | null, c: string | null) =>
      (!!email && norm(e) === email) || (!!child && norm(c) === child);
    const [{ data: parts }, { data: ents }] = await Promise.all([
      supabaseAdmin
        .from("course_participants")
        .select("id,participant_email,participant_name")
        .eq("status", "cancelled")
        .or("transferred_at.not.is.null,cancelled_at.not.is.null"),
      supabaseAdmin.from("waitlist_entries").select("id,parent_email,child_name"),
    ]);
    const partIds = (parts ?? [])
      .filter((p) => matches(p.participant_email, p.participant_name))
      .map((p) => p.id);
    const entryIds = (ents ?? [])
      .filter((e) => matches(e.parent_email, e.child_name))
      .map((e) => e.id);
    if (partIds.length) {
      const { error } = await supabaseAdmin
        .from("course_participants")
        .update({ block_review_dismissed_at: stamp })
        .in("id", partIds);
      if (error) throw new Error(error.message);
    }
    if (entryIds.length) {
      const { error } = await supabaseAdmin
        .from("waitlist_entries")
        .update({ block_review_dismissed_at: stamp })
        .in("id", entryIds);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
