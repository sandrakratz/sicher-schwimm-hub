/* eslint-disable @typescript-eslint/no-explicit-any -- Tabellen family_swim_* stehen erst nach der Migration in den generierten Supabase-Typen */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { todayBerlinIso } from "@/lib/format";
import { logAudit } from "@/lib/audit.server";
import {
  FAMILY_SWIM,
  SEAT_STATUSES,
  isLateCancel,
  pickNextFromWaitlist,
  personsFromMemberships,
  proposeAllocation,
  validateSelection,
  weekdayDate,
  EMPTY_STANDING,
  needsGrandstandSupervision,
  type AllocRequest,
  type MembershipForSwim,
  type Standing,
  type SwimPerson,
} from "@/lib/familienschwimmen";

const SITE = "https://sicher-schwimmen.com";
const MEMBER_URL = `${SITE}/portal/familienschwimmen`;

type Ctx = { supabase: any; userId: string };

async function assertStaff(context: Ctx) {
  const { data } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (!data) throw new Error("Forbidden");
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const timeShort = (t: string | null | undefined) => (t ?? "").slice(0, 5);
const slot = (e: any) =>
  `${weekdayDate(e.event_date)} · ${timeShort(e.start_time)}–${timeShort(e.end_time)} Uhr · ${e.location}`;
const personsLabel = (n: number) => `${n} ${n === 1 ? "Person" : "Personen"}`;

// ---------------------------------------------------------------------------
// Gemeinsame Helfer
// ---------------------------------------------------------------------------

type MailInput = {
  userId: string;
  to: string | null;
  name: string | null;
  heading: string;
  subject: string;
  intro: string;
  sections?: { title: string; items: string[] }[];
  note?: string | null;
  safety?: boolean;
  key: string;
};

async function sendFamilyMail(m: MailInput) {
  if (!m.to) return;
  try {
    const { queueTemplateEmail } = await import("@/lib/email-send.server");
    await queueTemplateEmail({
      templateName: "familienschwimmen",
      recipientEmail: m.to,
      idempotencyKey: m.key,
      templateData: {
        name: m.name ?? undefined,
        heading: m.heading,
        subject: m.subject,
        intro: m.intro,
        sections: m.sections ?? [],
        note: m.note ?? null,
        safety: !!m.safety,
        url: MEMBER_URL,
        button: "Meine Anmeldungen ansehen",
      },
    });
  } catch (err) {
    // Eine fehlgeschlagene Mail darf die Vergabe nicht zurückdrehen.
    console.error("[familienschwimmen] mail failed", err);
  }
}

/** Teilnahmen, Strafpunkte, letzte Teilnahme und bereits zugesagte künftige Termine je Konto. */
async function loadStanding(admin: any, userIds: string[]): Promise<Record<string, Standing>> {
  const out: Record<string, Standing> = {};
  if (userIds.length === 0) return out;
  const { data: rows, error } = await admin
    .from("family_swim_standing")
    .select("user_id,participations,strikes,last_participation")
    .in("user_id", userIds);
  if (error) throw new Error(error.message);
  for (const r of rows ?? []) {
    out[r.user_id] = {
      participations: Number(r.participations) || 0,
      strikes: Number(r.strikes) || 0,
      pendingConfirmed: 0,
      last_participation: r.last_participation ?? null,
    };
  }
  const { data: pending, error: pErr } = await admin
    .from("family_swim_requests")
    .select("user_id,family_swim_events!inner(event_date)")
    .eq("status", "confirmed")
    .gte("family_swim_events.event_date", todayBerlinIso())
    .in("user_id", userIds);
  if (pErr) throw new Error(pErr.message);
  for (const r of pending ?? []) {
    out[r.user_id] = out[r.user_id] ?? { ...EMPTY_STANDING };
    out[r.user_id]!.pendingConfirmed += 1;
  }
  return out;
}

async function usedSeats(admin: any, eventId: string): Promise<number> {
  const { data, error } = await admin
    .from("family_swim_requests")
    .select("seats")
    .eq("event_id", eventId)
    .in("status", SEAT_STATUSES);
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((s: number, r: any) => s + (r.seats as number), 0);
}

/** Nachrücken: so lange Familien aus der Warteliste zusagen, wie noch jemand in die freien Plätze passt. */
async function promoteWaitlist(
  admin: any,
  eventId: string,
  actorId: string | null,
): Promise<number> {
  const { data: event } = await admin
    .from("family_swim_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.status !== "open" || !event.allocated_at) return 0;
  if (event.event_date < todayBerlinIso()) return 0;

  let promoted = 0;
  for (let i = 0; i < 10; i++) {
    const free = event.capacity - (await usedSeats(admin, eventId));
    if (free <= 0) break;
    const { data: waiting } = await admin
      .from("family_swim_requests")
      .select("id,user_id,event_id,seats,requested_at,contact_name,contact_email")
      .eq("event_id", eventId)
      .eq("status", "waitlist");
    if (!waiting?.length) break;
    const standing = await loadStanding(admin, [
      ...new Set<string>(waiting.map((w: any) => w.user_id)),
    ]);
    const reqs: AllocRequest[] = waiting.map((w: any) => ({
      id: w.id,
      userId: w.user_id,
      eventId: w.event_id,
      seats: w.seats,
      requestedAt: w.requested_at,
    }));
    const next = pickNextFromWaitlist(free, reqs, standing);
    if (!next) break;
    const { data: res } = await admin.rpc("family_swim_confirm", { p_request_id: next.id });
    if (res !== "ok") break;
    promoted += 1;
    const w = waiting.find((x: any) => x.id === next.id);
    await sendFamilyMail({
      userId: next.userId,
      to: w?.contact_email ?? null,
      name: w?.contact_name ?? null,
      heading: "Ihr seid nachgerückt – Zusage für das Familienschwimmen",
      subject: `Nachgerückt: Familienschwimmen ${weekdayDate(event.event_date)}`,
      intro:
        "Bei diesem Termin ist ein Platz frei geworden. Ihr seid nachgerückt, die Teilnahme ist damit verbindlich zugesagt.",
      sections: [{ title: "Zugesagt", items: [`${slot(event)} · ${personsLabel(next.seats)}`] }],
      note: "Falls ihr doch nicht kommen könnt, sagt bitte im Mitgliederbereich ab, damit der Platz weitergegeben werden kann.",
      safety: true,
      key: `fs-promote-${next.id}`,
    });
    await logAudit(null, actorId ?? next.userId, {
      action: "family_swim.promoted",
      entity: "family_swim_requests",
      entity_id: next.id,
      metadata: { event_id: eventId, automatic: actorId == null },
    });
  }
  return promoted;
}

// ---------------------------------------------------------------------------
// Mitglieder
// ---------------------------------------------------------------------------

async function loadMembershipsOf(admin: any, userId: string): Promise<MembershipForSwim[]> {
  const { data, error } = await admin
    .from("memberships")
    .select("id,membership_type,status,first_name,last_name,date_of_birth,family_members")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []) as MembershipForSwim[];
}

async function contactOf(admin: any, userId: string, fallbackName: string) {
  const { data } = await admin
    .from("profiles")
    .select("email,first_name,last_name")
    .eq("id", userId)
    .maybeSingle();
  const name = [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim() || fallbackName;
  return { email: (data?.email as string | null) ?? null, name };
}

export type MyFamilySwim = {
  eligible: boolean;
  reason: string | null;
  persons: SwimPerson[];
  events: Array<{
    id: string;
    event_date: string;
    start_time: string;
    end_time: string;
    location: string;
    status: string;
    registration_deadline: string;
    open: boolean;
    closedReason: string | null;
    myRequest: null | {
      id: string;
      status: string;
      seats: number;
      persons: Array<{ name: string; role: string }>;
      canCancel: boolean;
      late: boolean;
    };
  }>;
};

export const getMyFamilySwim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyFamilySwim> => {
    const admin = await db();
    const userId = (context as Ctx).userId;
    const today = todayBerlinIso();
    const persons = personsFromMemberships(await loadMembershipsOf(admin, userId), today);
    const eligible = persons.length > 0;

    const { data: events, error } = await admin
      .from("family_swim_events")
      .select("*")
      .gte("event_date", today)
      .neq("status", "inactive")
      .order("event_date");
    if (error) throw new Error(error.message);
    const { data: mine } = await admin
      .from("family_swim_requests")
      .select("id,event_id,status,seats,persons")
      .eq("user_id", userId)
      .neq("status", "cancelled");
    const byEvent = new Map<string, any>((mine ?? []).map((r: any) => [r.event_id, r]));
    const now = Date.now();

    return {
      eligible,
      reason: eligible
        ? null
        : "Das Familienschwimmen ist nur für Vereinsmitglieder. Zu diesem Konto gehört keine aktive Mitgliedschaft, mit der man sich anmelden kann.",
      persons,
      events: (events ?? []).map((e: any) => {
        const r = byEvent.get(e.id) ?? null;
        let closedReason: string | null = null;
        if (e.status === "cancelled") closedReason = "Dieser Termin ist abgesagt.";
        else if (e.allocated_at) closedReason = "Die Plätze sind bereits vergeben.";
        else if (new Date(e.registration_deadline).getTime() < now)
          closedReason = "Anmeldeschluss ist vorbei.";
        return {
          id: e.id,
          event_date: e.event_date,
          start_time: timeShort(e.start_time),
          end_time: timeShort(e.end_time),
          location: e.location,
          status: e.status,
          registration_deadline: e.registration_deadline,
          open: closedReason == null,
          closedReason,
          myRequest: r
            ? {
                id: r.id,
                status: r.status,
                seats: r.seats,
                persons: (r.persons ?? []).map((p: any) => ({ name: p.name, role: p.role })),
                canCancel:
                  ["requested", "waitlist", "confirmed"].includes(r.status) &&
                  e.status !== "cancelled" &&
                  e.event_date >= today,
                late:
                  r.status === "confirmed" &&
                  isLateCancel(e.event_date, timeShort(e.start_time) || "12:00"),
              }
            : null,
        };
      }),
    };
  });

export const submitFamilySwim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        eventIds: z.array(z.string().uuid()).min(1).max(20),
        personKeys: z.array(z.string().min(3).max(80)).min(1).max(10),
        bronzeConfirmed: z.boolean().default(false),
        grandstandName: z.string().trim().max(120).default(""),
        note: z.string().trim().max(500).default(""),
        accepted: z.literal(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await db();
    const userId = (context as Ctx).userId;
    const today = todayBerlinIso();

    // Mitgliedschaft und Personen immer neu aus der Datenbank ermitteln – nie dem Browser glauben
    const all = personsFromMemberships(await loadMembershipsOf(admin, userId), today);
    if (all.length === 0) throw new Error("Für dieses Konto besteht keine aktive Mitgliedschaft.");
    const selected = data.personKeys.map((k) => all.find((p) => p.key === k));
    if (selected.some((p) => !p) || new Set(data.personKeys).size !== data.personKeys.length)
      throw new Error("Die Auswahl passt nicht zu den Personen in eurem Mitgliedskonto.");
    const chosen = selected as SwimPerson[];

    const problem = validateSelection({
      selected: chosen,
      bronzeConfirmed: data.bronzeConfirmed,
      grandstandName: data.grandstandName,
    });
    if (problem) throw new Error(problem);
    const needsStand = needsGrandstandSupervision(chosen);

    const { data: events } = await admin
      .from("family_swim_events")
      .select("*")
      .in("id", data.eventIds);
    if ((events ?? []).length !== new Set(data.eventIds).size)
      throw new Error("Ein gewählter Termin existiert nicht mehr.");
    const now = Date.now();
    for (const e of events ?? []) {
      if (
        e.status !== "open" ||
        e.allocated_at ||
        e.event_date < today ||
        new Date(e.registration_deadline).getTime() < now
      )
        throw new Error(`Für den ${weekdayDate(e.event_date)} ist keine Anmeldung mehr möglich.`);
      if (chosen.length > e.capacity)
        throw new Error(
          `Für den ${weekdayDate(e.event_date)} sind höchstens ${e.capacity} Personen möglich.`,
        );
    }

    const { data: existing } = await admin
      .from("family_swim_requests")
      .select("event_id")
      .eq("user_id", userId)
      .in("event_id", data.eventIds)
      .neq("status", "cancelled");
    if (existing?.length) {
      const dates = (events ?? [])
        .filter((e: any) => existing.some((x: any) => x.event_id === e.id))
        .map((e: any) => weekdayDate(e.event_date));
      throw new Error(`Für ${dates.join(", ")} liegt bereits eine Anmeldung vor.`);
    }

    const holder = chosen.find((p) => p.role === "adult") ?? chosen[0]!;
    const contact = await contactOf(admin, userId, holder.name);
    const batchId = crypto.randomUUID();

    const rows = (events ?? []).map((e: any) => ({
      event_id: e.id,
      user_id: userId,
      batch_id: batchId,
      contact_name: contact.name,
      contact_email: contact.email,
      persons: chosen.map((p) => ({
        key: p.key,
        name: p.name,
        role: p.role,
        date_of_birth: p.date_of_birth,
        membership_id: p.membership_id,
      })),
      seats: chosen.length,
      grandstand_name: needsStand ? data.grandstandName.trim() : null,
      bronze_confirmed: needsStand ? data.bronzeConfirmed : false,
      note: data.note || null,
    }));
    const { error } = await admin.from("family_swim_requests").insert(rows);
    if (error) {
      if (error.code === "23505")
        throw new Error("Für einen der Termine liegt bereits eine Anmeldung vor.");
      throw new Error(error.message);
    }

    await sendFamilyMail({
      userId,
      to: contact.email,
      name: contact.name,
      heading: "Wir haben eure Platzanfrage erhalten",
      subject: "Familienschwimmen: Platzanfrage eingegangen",
      intro:
        "Danke für eure Anmeldung. Wichtig: Das ist noch keine Zusage, sondern zunächst eine Platzanfrage. Verbindlich ist die Teilnahme erst, wenn ihr eine Zusage vom Verein bekommt. Nach dem Anmeldeschluss werden die Plätze fair vergeben, ihr hört dann von uns.",
      sections: [
        {
          title: "Eure Wunschtermine",
          items: (events ?? [])
            .sort((a: any, b: any) => a.event_date.localeCompare(b.event_date))
            .map((e: any) => `${slot(e)} · ${personsLabel(chosen.length)}`),
        },
        { title: "Angemeldet", items: chosen.map((p) => p.name) },
      ],
      key: `fs-recv-${batchId}`,
    });

    await logAudit(null, userId, {
      action: "family_swim.requested",
      entity: "family_swim_requests",
      entity_id: batchId,
      metadata: { events: data.eventIds.length, persons: chosen.length },
    });
    return { ok: true as const, events: rows.length };
  });

export const cancelFamilySwim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await db();
    const userId = (context as Ctx).userId;
    const { data: r } = await admin
      .from("family_swim_requests")
      .select("*, family_swim_events(*)")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!r || r.user_id !== userId) throw new Error("Anmeldung nicht gefunden.");
    const e = r.family_swim_events;
    if (!["requested", "waitlist", "confirmed"].includes(r.status))
      throw new Error("Diese Anmeldung kann nicht mehr abgesagt werden.");
    if (e.event_date < todayBerlinIso()) throw new Error("Der Termin liegt in der Vergangenheit.");

    const wasConfirmed = r.status === "confirmed";
    const late = wasConfirmed && isLateCancel(e.event_date, timeShort(e.start_time) || "12:00");
    const { error } = await admin
      .from("family_swim_requests")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), strike: late })
      .eq("id", r.id)
      .in("status", ["requested", "waitlist", "confirmed"]);
    if (error) throw new Error(error.message);

    await sendFamilyMail({
      userId,
      to: r.contact_email,
      name: r.contact_name,
      heading: "Eure Absage ist bei uns angekommen",
      subject: `Familienschwimmen: Absage ${weekdayDate(e.event_date)}`,
      intro:
        "Wir haben eure Absage für diesen Termin gespeichert. Danke, dass ihr Bescheid gesagt habt.",
      sections: [{ title: "Abgesagt", items: [slot(e)] }],
      note: late
        ? `Die Absage kam weniger als ${FAMILY_SWIM.lateCancelHours} Stunden vor dem Termin. Sie wird bei der nächsten Platzvergabe berücksichtigt, damit es fair für alle Familien bleibt.`
        : null,
      key: `fs-cancel-${r.id}`,
    });
    await logAudit(null, userId, {
      action: "family_swim.cancelled_by_member",
      entity: "family_swim_requests",
      entity_id: r.id,
      metadata: { late },
    });

    if (wasConfirmed) await promoteWaitlist(admin, e.id, null);
    return { ok: true as const, late };
  });

// ---------------------------------------------------------------------------
// Vorstand
// ---------------------------------------------------------------------------

export type AdminEvent = {
  id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string;
  capacity: number;
  registration_deadline: string;
  status: "open" | "inactive" | "cancelled";
  allocated_at: string | null;
  notes: string | null;
  confirmedSeats: number;
  confirmedFamilies: number;
  requestedFamilies: number;
  waitlistFamilies: number;
};

export type AdminRequest = {
  id: string;
  event_id: string;
  user_id: string;
  contact_name: string | null;
  contact_email: string | null;
  persons: Array<{ name: string; role: string; date_of_birth: string | null }>;
  seats: number;
  grandstand_name: string | null;
  bronze_confirmed: boolean;
  note: string | null;
  status: string;
  strike: boolean;
  strike_waived: boolean;
  requested_at: string;
  scrubbed_at: string | null;
  standing: Standing;
};

export type AdminFamily = {
  user_id: string;
  name: string | null;
  email: string | null;
  participations: number;
  strikes: number;
  last_participation: string | null;
  open: number;
};

export const getFamilySwimAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context as Ctx);
    const admin = await db();
    const { data: events, error } = await admin
      .from("family_swim_events")
      .select("*")
      .order("event_date");
    if (error) throw new Error(error.message);
    const { data: reqs, error: rErr } = await admin
      .from("family_swim_requests")
      .select("*")
      .neq("status", "cancelled")
      .order("requested_at")
      .limit(3000);
    if (rErr) throw new Error(rErr.message);

    const userIds = [...new Set<string>((reqs ?? []).map((r: any) => r.user_id))];
    const standing = await loadStanding(admin, userIds);

    const adminEvents: AdminEvent[] = (events ?? []).map((e: any) => {
      const mine = (reqs ?? []).filter((r: any) => r.event_id === e.id);
      const conf = mine.filter((r: any) => SEAT_STATUSES.includes(r.status));
      return {
        id: e.id,
        event_date: e.event_date,
        start_time: timeShort(e.start_time),
        end_time: timeShort(e.end_time),
        location: e.location,
        capacity: e.capacity,
        registration_deadline: e.registration_deadline,
        status: e.status,
        allocated_at: e.allocated_at,
        notes: e.notes,
        confirmedSeats: conf.reduce((s: number, r: any) => s + r.seats, 0),
        confirmedFamilies: conf.length,
        requestedFamilies: mine.filter((r: any) => r.status === "requested").length,
        waitlistFamilies: mine.filter((r: any) => r.status === "waitlist").length,
      };
    });

    const requests: AdminRequest[] = (reqs ?? []).map((r: any) => ({
      id: r.id,
      event_id: r.event_id,
      user_id: r.user_id,
      contact_name: r.contact_name,
      contact_email: r.contact_email,
      persons: r.persons ?? [],
      seats: r.seats,
      grandstand_name: r.grandstand_name,
      bronze_confirmed: r.bronze_confirmed,
      note: r.note,
      status: r.status,
      strike: r.strike,
      strike_waived: r.strike_waived,
      requested_at: r.requested_at,
      scrubbed_at: r.scrubbed_at,
      standing: standing[r.user_id] ?? EMPTY_STANDING,
    }));

    // Familienübersicht: alle Konten mit Anmeldungen oder Teilnahmehistorie
    const { data: stRows } = await admin
      .from("family_swim_standing")
      .select("user_id,participations,strikes,last_participation");
    const allIds = [...new Set<string>([...(stRows ?? []).map((s: any) => s.user_id), ...userIds])];
    const profiles = allIds.length
      ? ((await admin.from("profiles").select("id,first_name,last_name,email").in("id", allIds))
          .data ?? [])
      : [];
    const stMap = new Map<string, any>((stRows ?? []).map((s: any) => [s.user_id, s]));
    const families: AdminFamily[] = allIds
      .map((id) => {
        const p = profiles.find((x: any) => x.id === id);
        const s = stMap.get(id);
        return {
          user_id: id,
          name: p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || null : null,
          email: p?.email ?? null,
          participations: Number(s?.participations) || 0,
          strikes: Number(s?.strikes) || 0,
          last_participation: s?.last_participation ?? null,
          open: (reqs ?? []).filter(
            (r: any) =>
              r.user_id === id && ["requested", "waitlist", "confirmed"].includes(r.status),
          ).length,
        };
      })
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "de"));

    return { events: adminEvents, requests, families };
  });

export const saveFamilySwimEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        capacity: z.number().int().min(FAMILY_SWIM.capacityMin).max(FAMILY_SWIM.capacityMax),
        registration_deadline: z.string().min(10),
        status: z.enum(["open", "inactive"]),
        notes: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context as Ctx);
    const admin = await db();
    const patch = {
      event_date: data.event_date,
      capacity: data.capacity,
      registration_deadline: new Date(data.registration_deadline).toISOString(),
      status: data.status,
      notes: data.notes || null,
    };
    let id = data.id;
    if (id) {
      const { error } = await admin.from("family_swim_events").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await admin
        .from("family_swim_events")
        .insert(patch)
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") throw new Error("Für dieses Datum gibt es schon einen Termin.");
        throw new Error(error.message);
      }
      id = row.id;
    }
    await logAudit(null, (context as Ctx).userId, {
      action: data.id ? "family_swim.event_updated" : "family_swim.event_created",
      entity: "family_swim_events",
      entity_id: id,
      metadata: patch,
    });
    // Eine höhere Kapazität schafft Platz: Warteliste nachrücken lassen.
    // Eine niedrigere löscht niemanden – bestätigte Teilnehmer bleiben bestehen.
    if (data.id) await promoteWaitlist(admin, data.id, (context as Ctx).userId);
    return { ok: true as const, id };
  });

export const cancelFamilySwimEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context as Ctx);
    const admin = await db();
    const { data: e } = await admin
      .from("family_swim_events")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!e) throw new Error("Termin nicht gefunden.");
    const { data: affected } = await admin
      .from("family_swim_requests")
      .select("id,user_id,contact_email,contact_name")
      .eq("event_id", e.id)
      .in("status", ["requested", "waitlist", "confirmed"]);

    await admin.from("family_swim_events").update({ status: "cancelled" }).eq("id", e.id);
    await admin
      .from("family_swim_requests")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), strike: false })
      .eq("event_id", e.id)
      .in("status", ["requested", "waitlist", "confirmed"]);

    for (const r of affected ?? []) {
      await sendFamilyMail({
        userId: r.user_id,
        to: r.contact_email,
        name: r.contact_name,
        heading: "Das Familienschwimmen entfällt",
        subject: `Familienschwimmen abgesagt: ${weekdayDate(e.event_date)}`,
        intro:
          "Leider müssen wir diesen Termin absagen. Für euch entsteht kein Nachteil bei der Platzvergabe.",
        sections: [{ title: "Abgesagt", items: [slot(e)] }],
        key: `fs-event-cancel-${r.id}`,
      });
    }
    await logAudit(null, (context as Ctx).userId, {
      action: "family_swim.event_cancelled",
      entity: "family_swim_events",
      entity_id: e.id,
      metadata: { notified: (affected ?? []).length },
    });
    return { ok: true as const, notified: (affected ?? []).length };
  });

type Proposal = {
  confirmed: Array<{ requestId: string; round: number }>;
  waitlist: string[];
  requests: Map<string, any>;
  events: Map<string, any>;
  standing: Record<string, Standing>;
};

async function computeProposal(admin: any, eventIds: string[]): Promise<Proposal> {
  const { data: events } = await admin
    .from("family_swim_events")
    .select("*")
    .in("id", eventIds)
    .eq("status", "open");
  const evMap = new Map<string, any>((events ?? []).map((e: any) => [e.id, e]));
  const used: Record<string, number> = {};
  for (const e of events ?? []) used[e.id] = await usedSeats(admin, e.id);

  const { data: reqs } = await admin
    .from("family_swim_requests")
    .select("*")
    .in("event_id", [...evMap.keys()])
    .in("status", ["requested", "waitlist"]);
  const reqMap = new Map<string, any>((reqs ?? []).map((r: any) => [r.id, r]));
  const standing = await loadStanding(admin, [
    ...new Set<string>((reqs ?? []).map((r: any) => r.user_id)),
  ]);

  const result = proposeAllocation({
    events: [...evMap.values()].map((e) => ({
      id: e.id,
      date: e.event_date,
      capacity: e.capacity,
      usedSeats: used[e.id] ?? 0,
    })),
    requests: (reqs ?? []).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      eventId: r.event_id,
      seats: r.seats,
      requestedAt: r.requested_at,
    })),
    standing,
  });
  return { ...result, requests: reqMap, events: evMap, standing };
}

export type ProposalView = {
  rows: Array<{
    requestId: string;
    eventId: string;
    eventDate: string;
    name: string | null;
    seats: number;
    outcome: "confirmed" | "waitlist";
    round: number | null;
    participations: number;
    strikes: number;
    pendingConfirmed: number;
  }>;
};

export const proposeFamilySwim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ eventIds: z.array(z.string().uuid()).min(1).max(30) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ProposalView> => {
    await assertStaff(context as Ctx);
    const admin = await db();
    const p = await computeProposal(admin, data.eventIds);
    const view = (id: string, outcome: "confirmed" | "waitlist", round: number | null) => {
      const r = p.requests.get(id);
      const e = p.events.get(r.event_id);
      const s = p.standing[r.user_id] ?? EMPTY_STANDING;
      return {
        requestId: id,
        eventId: r.event_id,
        eventDate: e.event_date,
        name: r.contact_name,
        seats: r.seats,
        outcome,
        round,
        participations: s.participations,
        strikes: s.strikes,
        pendingConfirmed: s.pendingConfirmed,
      };
    };
    return {
      rows: [
        ...p.confirmed.map((c) => view(c.requestId, "confirmed", c.round)),
        ...p.waitlist.map((id) => view(id, "waitlist", null)),
      ].sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
    };
  });

/** Wendet die Vergabe an: neu berechnet, Plätze atomar gesetzt, eine Mail je Familie. */
export const applyFamilySwimAllocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ eventIds: z.array(z.string().uuid()).min(1).max(30) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context as Ctx);
    const admin = await db();
    const actor = (context as Ctx).userId;
    const p = await computeProposal(admin, data.eventIds);

    const outcome = new Map<string, "confirmed" | "waitlist">();
    for (const c of p.confirmed) {
      const { data: res } = await admin.rpc("family_swim_confirm", { p_request_id: c.requestId });
      outcome.set(c.requestId, res === "ok" ? "confirmed" : "waitlist");
    }
    for (const id of p.waitlist) outcome.set(id, "waitlist");

    const toWait = [...outcome.entries()].filter(([, o]) => o === "waitlist").map(([id]) => id);
    if (toWait.length)
      await admin
        .from("family_swim_requests")
        .update({ status: "waitlist", decided_at: new Date().toISOString() })
        .in("id", toWait)
        .eq("status", "requested");
    await admin
      .from("family_swim_events")
      .update({ allocated_at: new Date().toISOString() })
      .in("id", [...p.events.keys()]);

    // Eine Mail je Konto: Zusagen und Wartelisten gemeinsam. Wer schon auf der Warteliste war
    // und es bleibt, bekommt keine zweite Mail.
    const perUser = new Map<string, { conf: any[]; wait: any[]; ids: string[] }>();
    for (const [id, o] of outcome) {
      const r = p.requests.get(id);
      if (!r) continue;
      if (o === "waitlist" && r.status === "waitlist") continue;
      const u = perUser.get(r.user_id) ?? { conf: [], wait: [], ids: [] };
      (o === "confirmed" ? u.conf : u.wait).push(r);
      u.ids.push(id);
      perUser.set(r.user_id, u);
    }
    for (const [userId, u] of perUser) {
      const first = (u.conf[0] ?? u.wait[0])!;
      const line = (r: any) => `${slot(p.events.get(r.event_id))} · ${personsLabel(r.seats)}`;
      const sorted = (list: any[]) =>
        [...list].sort((a, b) =>
          p.events.get(a.event_id).event_date.localeCompare(p.events.get(b.event_id).event_date),
        );
      const sections = [];
      if (u.conf.length) sections.push({ title: "Zugesagt", items: sorted(u.conf).map(line) });
      if (u.wait.length)
        sections.push({
          title: "Warteliste (aktuell kein Platz)",
          items: sorted(u.wait).map(line),
        });
      await sendFamilyMail({
        userId,
        to: first.contact_email,
        name: first.contact_name,
        heading: u.conf.length
          ? "Eure Zusage für das Familienschwimmen"
          : "Familienschwimmen: Warteliste",
        subject: u.conf.length ? "Familienschwimmen: Zusage" : "Familienschwimmen: Warteliste",
        intro: u.conf.length
          ? "Wir haben für euch Plätze vergeben. Die Teilnahme an den zugesagten Terminen ist damit verbindlich."
          : "Bei den gewünschten Terminen ist leider kein Platz mehr frei. Ihr steht auf der Warteliste. Wird ein Platz frei, rückt die Familie mit der höchsten Priorität nach und bekommt automatisch Bescheid.",
        sections,
        note:
          u.wait.length && u.conf.length
            ? "Für die Termine auf der Warteliste rücken wir nach, sobald ein Platz frei wird."
            : null,
        safety: u.conf.length > 0,
        key: `fs-alloc-${userId}-${u.ids.map((i) => i.slice(0, 8)).join("")}`,
      });
    }

    await logAudit(null, actor, {
      action: "family_swim.allocated",
      entity: "family_swim_events",
      entity_id: null,
      metadata: {
        events: [...p.events.keys()],
        confirmed: [...outcome.values()].filter((o) => o === "confirmed").length,
        waitlist: toWait.length,
      },
    });
    return {
      ok: true as const,
      confirmed: [...outcome.values()].filter((o) => o === "confirmed").length,
      waitlist: toWait.length,
      mails: perUser.size,
    };
  });

export const setFamilySwimRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        action: z.enum([
          "confirm",
          "waitlist",
          "decline",
          "cancel",
          "attended",
          "no_show",
          "reopen",
          "waive_strike",
          "restore_strike",
        ]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context as Ctx);
    const admin = await db();
    const actor = (context as Ctx).userId;
    const { data: r } = await admin
      .from("family_swim_requests")
      .select("*, family_swim_events(*)")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!r) throw new Error("Anmeldung nicht gefunden.");
    const e = r.family_swim_events;
    const now = new Date().toISOString();
    let message = "Gespeichert.";

    switch (data.action) {
      case "confirm": {
        const { data: res } = await admin.rpc("family_swim_confirm", { p_request_id: r.id });
        if (res === "full")
          throw new Error(
            "Nicht genug freie Plätze – es wird nie überbucht. Erst Kapazität oder andere Zusagen ändern.",
          );
        if (res !== "ok") throw new Error("Zusage nicht möglich (Status oder Termin passt nicht).");
        await sendFamilyMail({
          userId: r.user_id,
          to: r.contact_email,
          name: r.contact_name,
          heading: "Eure Zusage für das Familienschwimmen",
          subject: `Familienschwimmen: Zusage ${weekdayDate(e.event_date)}`,
          intro: "Wir haben für euch einen Platz. Die Teilnahme ist damit verbindlich zugesagt.",
          sections: [{ title: "Zugesagt", items: [`${slot(e)} · ${personsLabel(r.seats)}`] }],
          safety: true,
          key: `fs-confirm-${r.id}-${Date.now().toString(36)}`,
        });
        message = "Zugesagt, Mail ist raus.";
        break;
      }
      case "waitlist":
        if (!["requested", "confirmed", "declined"].includes(r.status))
          throw new Error("Status kann nicht auf Warteliste gesetzt werden.");
        await admin
          .from("family_swim_requests")
          .update({ status: "waitlist", decided_at: now })
          .eq("id", r.id);
        if (r.status === "confirmed") await promoteWaitlist(admin, e.id, actor);
        break;
      case "decline":
        await admin
          .from("family_swim_requests")
          .update({ status: "declined", decided_at: now })
          .eq("id", r.id)
          .in("status", ["requested", "waitlist", "confirmed"]);
        if (r.status === "confirmed") await promoteWaitlist(admin, e.id, actor);
        break;
      case "cancel":
        await admin
          .from("family_swim_requests")
          .update({ status: "cancelled", cancelled_at: now })
          .eq("id", r.id)
          .in("status", ["requested", "waitlist", "confirmed"]);
        if (r.status === "confirmed") await promoteWaitlist(admin, e.id, actor);
        break;
      case "attended":
        if (r.status !== "confirmed" && r.status !== "no_show")
          throw new Error("Nur bestätigte Anmeldungen können als teilgenommen gelten.");
        await admin
          .from("family_swim_requests")
          .update({ status: "attended", strike: false })
          .eq("id", r.id);
        break;
      case "no_show":
        if (r.status !== "confirmed" && r.status !== "attended")
          throw new Error("Nur bestätigte Anmeldungen können als nicht erschienen gelten.");
        await admin
          .from("family_swim_requests")
          .update({ status: "no_show", strike: true })
          .eq("id", r.id);
        break;
      case "reopen":
        if (r.status !== "attended" && r.status !== "no_show")
          throw new Error("Nichts zurückzusetzen.");
        await admin
          .from("family_swim_requests")
          .update({ status: "confirmed", strike: false })
          .eq("id", r.id);
        break;
      case "waive_strike":
        await admin.from("family_swim_requests").update({ strike_waived: true }).eq("id", r.id);
        break;
      case "restore_strike":
        await admin.from("family_swim_requests").update({ strike_waived: false }).eq("id", r.id);
        break;
    }

    await logAudit(null, actor, {
      action: `family_swim.request_${data.action}`,
      entity: "family_swim_requests",
      entity_id: r.id,
      metadata: { event_id: e.id, previous: r.status },
    });
    return { ok: true as const, message };
  });

export const promoteFamilySwimWaitlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context as Ctx);
    const admin = await db();
    const n = await promoteWaitlist(admin, data.eventId, (context as Ctx).userId);
    return { ok: true as const, promoted: n };
  });
