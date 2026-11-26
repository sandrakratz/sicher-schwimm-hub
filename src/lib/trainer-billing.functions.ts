/* eslint-disable @typescript-eslint/no-explicit-any -- neue Spalten/Tabellen (Freigabe, Jahreserklärung) fehlen noch in den generierten Typen */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchAll, fetchIn } from "@/lib/fetch-all";
import {
  amountOf,
  ANNUAL_ALLOWANCE,
  capCheck,
  certificateSigners,
  pickRate,
  resolveHours,
  type Rate,
  type Signer,
} from "@/lib/trainer-billing";
import { assertStaff, assertTrainer } from "@/lib/auth-guards.server";
import { CERT_BOARD, CERT_TREASURER } from "@/lib/billing-config";
import { fullName, todayBerlinIso } from "@/lib/format";

export type BillingRow = {
  sessionId: string;
  trainerId: string;
  trainerName: string;
  courseId: string;
  courseName: string;
  programId: string | null;
  programName: string | null;
  date: string;
  sessionIndex: number;
  startTime: string | null;
  endTime: string | null;
  /** Abgerechnete Stunden (Kurs, sonst Kursart); null = noch nicht festgelegt */
  hours: number | null;
  /** Gültiger Stundensatz; null = noch keiner erfasst */
  rate: number | null;
  amount: number | null;
  /** War die Trainer:in dem Termin zugeteilt? Nur dann wird bezahlt. */
  assigned: boolean;
  paid: { payoutId: string; paidOn: string; amount: number } | null;
};

export type BillingOverview = {
  rows: BillingRow[];
  rates: (Rate & { programName: string | null })[];
  trainers: { id: string; name: string }[];
  programs: { id: string; name: string; billedHours: number | null }[];
  courses: { id: string; name: string }[];
  /** Im laufenden Jahr bereits ausgezahlt bzw. zur Freigabe angelegt je Trainer:in (nach Auszahlungsdatum) */
  paidInYear: Record<string, number>;
  /** Jahreserklärung der Trainer:innen für das laufende Jahr (fehlt = nicht abgegeben) */
  declarations: Record<string, Declaration>;
  year: number;
};

export type Declaration = {
  year: number;
  sideJob: boolean;
  otherAllowance: number;
  otherNote: string | null;
  confirmedAt: string;
};

export type PayoutStatus = "pending" | "approved";

export type MyPayout = {
  id: string;
  status: PayoutStatus;
  paidOn: string;
  total: number;
  note: string | null;
  items: {
    sessionDate: string;
    courseName: string;
    hours: number;
    rate: number;
    amount: number;
  }[];
};

function nameOf(p?: { first_name: string | null; last_name: string | null; email: string | null }) {
  return fullName(p?.first_name, p?.last_name) || p?.email || "Unbekannt";
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum ungültig");

const mapDeclaration = (d: any): Declaration => ({
  year: Number(d.year),
  sideJob: !!d.side_job,
  otherAllowance: Number(d.other_allowance ?? 0),
  otherNote: (d.other_note as string | null) ?? null,
  confirmedAt: d.confirmed_at as string,
});

/**
 * Harte Grenze (Satzung: Vergütung nur im Rahmen der Pauschale): Liegt die Auszahlung über dem Rest des
 * Jahresfreibetrags oder fehlt die Jahreserklärung, geht es nur mit Begründung (wird gespeichert).
 */
async function capGuard(
  trainerId: string,
  paidOn: string,
  amount: number,
  overrideReason: string | undefined,
): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const year = paidOn.slice(0, 4);
  const [{ data: payouts }, { data: decl }] = await Promise.all([
    supabaseAdmin
      .from("trainer_payouts")
      .select("total_amount")
      .eq("trainer_id", trainerId)
      .gte("paid_on", `${year}-01-01`)
      .lte("paid_on", `${year}-12-31`),
    (supabaseAdmin as any)
      .from("trainer_declarations")
      .select("other_allowance")
      .eq("trainer_id", trainerId)
      .eq("year", Number(year))
      .maybeSingle(),
  ]);
  const paid = (payouts ?? []).reduce((s, p) => s + Number(p.total_amount), 0);
  const c = capCheck(paid, Number(decl?.other_allowance ?? 0), amount);
  const problems = [
    ...(decl ? [] : [`Die Jahreserklärung ${year} der Trainer:in fehlt.`]),
    ...(c.over
      ? [
          `Damit wären es ${c.after.toFixed(2).replace(".", ",")} € im Jahr ${year} – über der Grenze von ${ANNUAL_ALLOWANCE} € (Rest: ${c.remaining.toFixed(2).replace(".", ",")} €).`,
        ]
      : []),
  ];
  if (problems.length === 0) return null;
  const reason = (overrideReason ?? "").trim();
  if (reason.length < 10)
    throw new Error(`${problems.join(" ")} Bitte eine Begründung angeben (mindestens 10 Zeichen).`);
  return `${problems.join(" ")} Begründung: ${reason}`;
}

/** Bestätigte Einsätze (mit Satz, Stunden, Betrag, Auszahlungsstatus) für Vorstand/Buchhaltung. */
export const getBillingOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        from: isoDate.optional(),
        to: isoDate.optional(),
        courseId: z.string().uuid().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<BillingOverview> => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const att = await fetchAll<any>((f, t) => {
      let q = supabaseAdmin
        .from("trainer_session_attendance")
        .select(
          "id,session_id,trainer_id,course_sessions!inner(id,session_date,session_index,start_time,end_time,course_id,assigned_trainer_id,courses(id,name,program_id,billed_hours))",
        )
        .eq("present", true)
        .not("confirmed_at", "is", null);
      if (data.from) q = q.gte("course_sessions.session_date", data.from);
      if (data.to) q = q.lte("course_sessions.session_date", data.to);
      if (data.courseId) q = q.eq("course_sessions.course_id", data.courseId);
      return q.order("id").range(f, t);
    });

    const sessionIds = att.map((a) => a.session_id as string);
    const [assignments, items] = await Promise.all([
      fetchIn<{ session_id: string; trainer_id: string }>(sessionIds, (chunk, f, t) =>
        supabaseAdmin
          .from("course_session_assignments")
          .select("session_id,trainer_id")
          .in("session_id", chunk)
          .order("id")
          .range(f, t),
      ),
      fetchIn<any>(sessionIds, (chunk, f, t) =>
        supabaseAdmin
          .from("trainer_payout_items")
          .select("session_id,trainer_id,amount,payout_id,trainer_payouts(paid_on)")
          .in("session_id", chunk)
          .order("id")
          .range(f, t),
      ),
    ]);
    const assignedSet = new Set(assignments.map((a) => `${a.session_id}:${a.trainer_id}`));
    const paidMap = new Map<string, { payoutId: string; paidOn: string; amount: number }>(
      items.map((i) => [
        `${i.session_id}:${i.trainer_id}`,
        {
          payoutId: i.payout_id as string,
          paidOn: i.trainer_payouts?.paid_on as string,
          amount: Number(i.amount),
        },
      ]),
    );

    const trainerIds = Array.from(new Set(att.map((a) => a.trainer_id as string)));
    const [{ data: profiles }, { data: programs }, rateRows, { data: allCourses }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id,first_name,last_name,email").in("id", trainerIds),
        supabaseAdmin.from("course_programs").select("id,name,billed_hours").order("name"),
        fetchAll<any>((f, t) =>
          supabaseAdmin.from("trainer_rates").select("*").order("id").range(f, t),
        ),
        supabaseAdmin.from("courses").select("id,name").order("name"),
      ]);
    const nameById = new Map((profiles ?? []).map((p) => [p.id as string, nameOf(p)]));
    const programName = new Map((programs ?? []).map((p) => [p.id as string, p.name as string]));
    const programHours = new Map(
      (programs ?? []).map((p) => [p.id as string, p.billed_hours as number | null]),
    );
    const rates: Rate[] = rateRows.map((r) => ({
      id: r.id,
      trainer_id: r.trainer_id,
      program_id: r.program_id,
      hourly_rate: Number(r.hourly_rate),
      valid_from: r.valid_from,
    }));

    const rows: BillingRow[] = att
      .map((a) => {
        const s = a.course_sessions;
        const key = `${a.session_id}:${a.trainer_id}`;
        const programId: string | null = s.courses?.program_id ?? null;
        const hours = resolveHours(
          s.courses?.billed_hours,
          programId ? programHours.get(programId) : null,
        );
        const rate = pickRate(rates, a.trainer_id, programId, s.session_date)?.hourly_rate ?? null;
        return {
          sessionId: a.session_id,
          trainerId: a.trainer_id,
          trainerName: nameById.get(a.trainer_id) ?? "Unbekannt",
          courseId: s.course_id,
          courseName: s.courses?.name ?? "Kurs",
          programId,
          programName: programId ? (programName.get(programId) ?? null) : null,
          date: s.session_date,
          sessionIndex: s.session_index,
          startTime: s.start_time ?? null,
          endTime: s.end_time ?? null,
          hours,
          rate,
          amount: hours !== null && rate !== null ? amountOf(hours, rate) : null,
          assigned: assignedSet.has(key) || s.assigned_trainer_id === a.trainer_id,
          paid: paidMap.get(key) ?? null,
        } satisfies BillingRow;
      })
      .sort(
        (a, b) =>
          a.trainerName.localeCompare(b.trainerName, "de") ||
          a.date.localeCompare(b.date) ||
          a.sessionIndex - b.sessionIndex,
      );

    // Bereits ausgezahlt im laufenden Jahr (alle Trainer:innen, unabhängig vom Filter)
    const year = Number(todayBerlinIso().slice(0, 4));
    const payouts = await fetchAll<{ trainer_id: string; total_amount: number }>((f, t) =>
      supabaseAdmin
        .from("trainer_payouts")
        .select("trainer_id,total_amount")
        .gte("paid_on", `${year}-01-01`)
        .lte("paid_on", `${year}-12-31`)
        .order("id")
        .range(f, t),
    );
    const paidInYear: Record<string, number> = {};
    for (const p of payouts)
      paidInYear[p.trainer_id] = (paidInYear[p.trainer_id] ?? 0) + Number(p.total_amount);

    const declRows = await fetchAll<any>((f, t) =>
      (supabaseAdmin as any)
        .from("trainer_declarations")
        .select("trainer_id,year,side_job,other_allowance,other_note,confirmed_at")
        .eq("year", year)
        .order("id")
        .range(f, t),
    );
    const declarations: Record<string, Declaration> = {};
    for (const d of declRows) declarations[d.trainer_id] = mapDeclaration(d);

    // Alle Trainer:innen mit Rolle für die Satz-Erfassung
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "trainer");
    const allTrainerIds = Array.from(
      new Set([...(roleRows ?? []).map((r) => r.user_id as string), ...trainerIds]),
    );
    const { data: trainerProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id,first_name,last_name,email")
      .in("id", allTrainerIds);
    const trainers = (trainerProfiles ?? [])
      .map((p) => ({ id: p.id as string, name: nameOf(p) }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));

    return {
      rows,
      rates: rates.map((r) => ({
        ...r,
        programName: r.program_id ? (programName.get(r.program_id) ?? null) : null,
      })),
      trainers,
      programs: (programs ?? []).map((p) => ({
        id: p.id as string,
        name: p.name as string,
        billedHours: p.billed_hours === null ? null : Number(p.billed_hours),
      })),
      courses: (allCourses ?? []).map((c) => ({ id: c.id as string, name: c.name as string })),
      paidInYear,
      declarations,
      year,
    };
  });

/** Standard der abgerechneten Stunden je Kursart festlegen (leer = nicht festgelegt). */
export const setProgramBilledHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        programId: z.string().uuid(),
        hours: z.number().gt(0).max(12).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("course_programs")
      .update({ billed_hours: data.hours })
      .eq("id", data.programId);
    if (error) throw new Error("Stunden konnten nicht gespeichert werden.");
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(null, context.userId, {
      action: "trainer.program_hours.saved",
      entity: "course_programs",
      entity_id: data.programId,
      metadata: { hours: data.hours },
    });
    return { ok: true };
  });

/** Stundensatz erfassen oder ändern (je Trainer:in, Kursart und „gültig ab“). */
export const saveTrainerRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        trainerId: z.string().uuid(),
        programId: z.string().uuid().nullable(),
        hourlyRate: z.number().min(0).max(500),
        validFrom: isoDate,
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hourly = Math.round(data.hourlyRate * 100) / 100;

    let find = supabaseAdmin
      .from("trainer_rates")
      .select("id")
      .eq("trainer_id", data.trainerId)
      .eq("valid_from", data.validFrom);
    find = data.programId ? find.eq("program_id", data.programId) : find.is("program_id", null);
    const { data: existing } = await find.maybeSingle();

    const { error } = existing
      ? await supabaseAdmin
          .from("trainer_rates")
          .update({ hourly_rate: hourly, created_by: context.userId })
          .eq("id", existing.id)
      : await supabaseAdmin.from("trainer_rates").insert({
          trainer_id: data.trainerId,
          program_id: data.programId,
          hourly_rate: hourly,
          valid_from: data.validFrom,
          created_by: context.userId,
        });
    if (error) throw new Error("Satz konnte nicht gespeichert werden.");

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(null, context.userId, {
      action: "trainer.rate.saved",
      entity: "trainer_rates",
      entity_id: data.trainerId,
      metadata: { program_id: data.programId, hourly_rate: hourly, valid_from: data.validFrom },
    });
    return { ok: true };
  });

export const deleteTrainerRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("trainer_rates").delete().eq("id", data.id);
    if (error) throw new Error("Satz konnte nicht gelöscht werden.");
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(null, context.userId, {
      action: "trainer.rate.deleted",
      entity: "trainer_rates",
      entity_id: data.id,
    });
    return { ok: true };
  });

/**
 * Auszahlung bestätigen: Die Buchhaltung wählt Termine einer Trainer:in, die Server-Funktion berechnet
 * Stunden, Satz und Betrag neu (nichts vom Browser wird übernommen) und schreibt sie fest.
 * Nur bestätigte, zugeteilte, noch nicht ausgezahlte Termine mit Satz und Dauer sind zahlbar.
 */
export const createTrainerPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        trainerId: z.string().uuid(),
        sessionIds: z.array(z.string().uuid()).min(1).max(500),
        paidOn: isoDate,
        note: z.string().trim().max(300).optional(),
        overrideReason: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(
    async ({ context, data }): Promise<{ payoutId: string; total: number; count: number }> => {
      await assertStaff(context);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const att = await fetchIn<any>(data.sessionIds, (chunk, f, t) =>
        supabaseAdmin
          .from("trainer_session_attendance")
          .select(
            "id,session_id,course_sessions(id,session_date,start_time,end_time,assigned_trainer_id,courses(name,program_id,billed_hours))",
          )
          .eq("trainer_id", data.trainerId)
          .eq("present", true)
          .not("confirmed_at", "is", null)
          .in("session_id", chunk)
          .order("id")
          .range(f, t),
      );
      const assignments = await fetchIn<{ session_id: string }>(data.sessionIds, (chunk, f, t) =>
        supabaseAdmin
          .from("course_session_assignments")
          .select("session_id")
          .eq("trainer_id", data.trainerId)
          .in("session_id", chunk)
          .order("id")
          .range(f, t),
      );
      const assignedSet = new Set(assignments.map((a) => a.session_id));
      const alreadyPaid = await fetchIn<{ session_id: string }>(data.sessionIds, (chunk, f, t) =>
        supabaseAdmin
          .from("trainer_payout_items")
          .select("session_id")
          .eq("trainer_id", data.trainerId)
          .in("session_id", chunk)
          .order("id")
          .range(f, t),
      );
      if (alreadyPaid.length > 0)
        throw new Error("Mindestens ein Termin wurde bereits ausgezahlt. Bitte Seite neu laden.");

      const [rateRows, { data: programs }] = await Promise.all([
        fetchAll<any>((f, t) =>
          supabaseAdmin
            .from("trainer_rates")
            .select("*")
            .eq("trainer_id", data.trainerId)
            .order("id")
            .range(f, t),
        ),
        supabaseAdmin.from("course_programs").select("id,name,billed_hours"),
      ]);
      const rates: Rate[] = rateRows.map((r) => ({
        id: r.id,
        trainer_id: r.trainer_id,
        program_id: r.program_id,
        hourly_rate: Number(r.hourly_rate),
        valid_from: r.valid_from,
      }));
      const programName = new Map((programs ?? []).map((p) => [p.id as string, p.name as string]));
      const programHours = new Map(
        (programs ?? []).map((p) => [p.id as string, p.billed_hours as number | null]),
      );

      const items: {
        session_id: string;
        session_date: string;
        course_name: string;
        program_name: string | null;
        hours_billed: number;
        hourly_rate: number;
        amount: number;
      }[] = [];
      for (const a of att) {
        const s = a.course_sessions;
        if (!s) continue;
        const assigned = assignedSet.has(a.session_id) || s.assigned_trainer_id === data.trainerId;
        const programId: string | null = s.courses?.program_id ?? null;
        const hours = resolveHours(
          s.courses?.billed_hours,
          programId ? programHours.get(programId) : null,
        );
        const rate = pickRate(rates, data.trainerId, programId, s.session_date);
        if (!assigned || hours === null || !rate) continue;
        items.push({
          session_id: a.session_id,
          session_date: s.session_date,
          course_name: s.courses?.name ?? "Kurs",
          program_name: programId ? (programName.get(programId) ?? null) : null,
          hours_billed: hours,
          hourly_rate: rate.hourly_rate,
          amount: amountOf(hours, rate.hourly_rate),
        });
      }
      if (items.length !== data.sessionIds.length)
        throw new Error(
          "Nicht alle gewählten Termine sind zahlbar (bestätigt, zugeteilt, Dauer und Satz vorhanden). Bitte Seite neu laden.",
        );

      const total = Math.round(items.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
      const override = await capGuard(data.trainerId, data.paidOn, total, data.overrideReason);
      const { data: payout, error } = await supabaseAdmin
        .from("trainer_payouts")
        .insert({
          trainer_id: data.trainerId,
          paid_on: data.paidOn,
          total_amount: total,
          note: data.note || null,
          created_by: context.userId,
          // Vier Augen: angelegt von der Buchhaltung, freigegeben von einer zweiten Person
          status: "pending",
          cap_override_reason: override,
        } as never)
        .select("id")
        .single();
      if (error || !payout) throw new Error("Auszahlung konnte nicht gespeichert werden.");

      const { error: itemsError } = await supabaseAdmin
        .from("trainer_payout_items")
        .insert(items.map((i) => ({ ...i, payout_id: payout.id, trainer_id: data.trainerId })));
      if (itemsError) {
        await supabaseAdmin.from("trainer_payouts").delete().eq("id", payout.id);
        throw new Error("Auszahlung konnte nicht gespeichert werden.");
      }

      const { logAudit } = await import("@/lib/audit.server");
      await logAudit(null, context.userId, {
        action: "trainer.payout.confirmed",
        entity: "trainer_payouts",
        entity_id: payout.id,
        metadata: {
          trainer_id: data.trainerId,
          total,
          count: items.length,
          paid_on: data.paidOn,
          status: "pending",
          cap_override: override,
        },
      });
      return { payoutId: payout.id, total, count: items.length };
    },
  );

/**
 * Auszahlung entfernen (z. B. Fehlbuchung); die Termine sind danach wieder offen. Nicht freigegebene
 * Auszahlungen sofort, freigegebene nur als Bestätigung eines Storno-Antrags durch eine zweite Person
 * (payoutRemovalBlocker). Das Protokoll hält Antrag, Grund und Bestätigung fest.
 */
export const deleteTrainerPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payout } = await (supabaseAdmin as any)
      .from("trainer_payouts")
      .select(
        "trainer_id,total_amount,paid_on,status,approved_by,cancel_requested_by,cancel_requested_at,cancel_reason",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!payout) throw new Error("Auszahlung nicht gefunden.");
    const { payoutRemovalBlocker } = await import("@/lib/trainer-billing");
    const blocker = payoutRemovalBlocker(
      {
        status: payout.status ?? "approved",
        trainerId: payout.trainer_id,
        cancelRequestedBy: payout.cancel_requested_by ?? null,
      },
      context.userId,
    );
    if (blocker) throw new Error(blocker);
    // Nur löschen, wenn sich Status/Antrag seit dem Lesen nicht geändert haben
    let del = (supabaseAdmin as any).from("trainer_payouts").delete().eq("id", data.id);
    del =
      payout.status === "pending"
        ? del.eq("status", "pending")
        : del.eq("cancel_requested_by", payout.cancel_requested_by);
    const { error } = await del;
    if (error) throw new Error("Auszahlung konnte nicht gelöscht werden.");
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(null, context.userId, {
      action: payout.status === "pending" ? "trainer.payout.deleted" : "trainer.payout.cancelled",
      entity: "trainer_payouts",
      entity_id: data.id,
      metadata: payout,
    });
    return { ok: true };
  });

/** Stornierung einer freigegebenen Auszahlung beantragen (Schritt 1 von 2, Grund Pflicht). */
export const requestPayoutCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().trim().min(3).max(500) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await (supabaseAdmin as any)
      .from("trainer_payouts")
      .update({
        cancel_requested_by: context.userId,
        cancel_requested_at: new Date().toISOString(),
        cancel_reason: data.reason,
      })
      .eq("id", data.id)
      .eq("status", "approved")
      .is("cancel_requested_by", null)
      .select("trainer_id,total_amount,paid_on");
    if (error) throw new Error("Stornierung konnte nicht beantragt werden.");
    if (!updated?.length)
      throw new Error("Nicht möglich: Die Auszahlung ist nicht freigegeben oder schon beantragt.");
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(null, context.userId, {
      action: "trainer.payout.cancel_requested",
      entity: "trainer_payouts",
      entity_id: data.id,
      metadata: { ...updated[0], reason: data.reason },
    });
    return { ok: true as const };
  });

/** Storno-Antrag zurückziehen bzw. ablehnen – die Auszahlung bleibt freigegeben. */
export const withdrawPayoutCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("trainer_payouts")
      .update({ cancel_requested_by: null, cancel_requested_at: null, cancel_reason: null })
      .eq("id", data.id);
    if (error) throw new Error("Antrag konnte nicht zurückgenommen werden.");
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(null, context.userId, {
      action: "trainer.payout.cancel_withdrawn",
      entity: "trainer_payouts",
      entity_id: data.id,
      metadata: {},
    });
    return { ok: true as const };
  });

/** Eigene Auszahlungen eines Jahres (Trainer:in sieht, was ihr wann ausgezahlt wurde). */
export const getMyPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ year: z.number().int().min(2020).max(2100) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ payouts: MyPayout[] }> => {
    // status fehlt noch in den generierten Typen
    const { data: payouts, error } = await (context.supabase as any)
      .from("trainer_payouts")
      .select("id,paid_on,total_amount,note,status")
      .eq("trainer_id", context.userId)
      .gte("paid_on", `${data.year}-01-01`)
      .lte("paid_on", `${data.year}-12-31`)
      .order("paid_on", { ascending: false });
    if (error) throw new Error("Auszahlungen konnten nicht geladen werden.");
    const ids = (payouts ?? []).map((p: any) => p.id as string);
    const items = await fetchIn<any>(ids, (chunk, f, t) =>
      context.supabase
        .from("trainer_payout_items")
        .select("payout_id,session_date,course_name,hours_billed,hourly_rate,amount")
        .in("payout_id", chunk)
        .order("session_date")
        .order("id")
        .range(f, t),
    );
    return {
      payouts: (payouts ?? []).map((p: any) => ({
        id: p.id as string,
        status: ((p as any).status ?? "approved") as PayoutStatus,
        paidOn: p.paid_on as string,
        total: Number(p.total_amount),
        note: (p.note as string | null) ?? null,
        items: items
          .filter((i) => i.payout_id === p.id)
          .map((i) => ({
            sessionDate: i.session_date,
            courseName: i.course_name,
            hours: Number(i.hours_billed),
            rate: Number(i.hourly_rate),
            amount: Number(i.amount),
          })),
      })),
    };
  });

export type PayoutListEntry = {
  id: string;
  status: PayoutStatus;
  createdBy: string | null;
  createdByName: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  overrideReason: string | null;
  trainerId: string;
  trainerName: string;
  paidOn: string;
  total: number;
  note: string | null;
  /** Anzahl der verknüpften Termine; 0 = nachträglich erfasste Auszahlung ohne Termine */
  itemCount: number;
  /** Beantragte Stornierung einer freigegebenen Auszahlung (wartet auf zweite Person) */
  cancelRequest: { byId: string; byName: string | null; at: string; reason: string | null } | null;
};

export type Certificate = {
  trainerName: string;
  year: number;
  total: number;
  payouts: MyPayout[];
  /** Wer unterschreibt (nie die Person selbst) */
  signers: Signer[];
  /** Noch nicht freigegebene Auszahlungen des Jahres (nicht auf der Bescheinigung) */
  pendingCount: number;
};

/**
 * Frühere Auszahlung nachtragen (z. B. bereits überwiesene Beträge aus den ersten Monaten 2026, für die
 * es keine bestätigten Termine im Portal gibt). Zählt für Freibetrag-Stand und Jahresbescheinigung mit.
 */
export const createManualPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        trainerId: z.string().uuid(),
        paidOn: isoDate,
        amount: z.number().gt(0).max(100000),
        note: z.string().trim().max(300).optional(),
        overrideReason: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const amount = Math.round(data.amount * 100) / 100;
    const override = await capGuard(data.trainerId, data.paidOn, amount, data.overrideReason);
    const { data: payout, error } = await supabaseAdmin
      .from("trainer_payouts")
      .insert({
        trainer_id: data.trainerId,
        paid_on: data.paidOn,
        total_amount: amount,
        note: data.note || "Nachträglich erfasst",
        created_by: context.userId,
        status: "pending",
        cap_override_reason: override,
      } as never)
      .select("id")
      .single();
    if (error || !payout) throw new Error("Auszahlung konnte nicht gespeichert werden.");
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(null, context.userId, {
      action: "trainer.payout.manual",
      entity: "trainer_payouts",
      entity_id: payout.id,
      metadata: {
        trainer_id: data.trainerId,
        amount,
        paid_on: data.paidOn,
        cap_override: override,
      },
    });
    return { payoutId: payout.id };
  });

/** Alle Auszahlungen eines Jahres (Vorstand/Buchhaltung), optional für eine Trainer:in. */
export const listTrainerPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        year: z.number().int().min(2020).max(2100),
        trainerId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ payouts: PayoutListEntry[] }> => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payouts = await fetchAll<any>((f, t) => {
      let q = supabaseAdmin
        .from("trainer_payouts")
        .select(
          "id,trainer_id,paid_on,total_amount,note,status,created_by,approved_by,approved_at,cap_override_reason,cancel_requested_by,cancel_requested_at,cancel_reason",
        )
        .gte("paid_on", `${data.year}-01-01`)
        .lte("paid_on", `${data.year}-12-31`);
      if (data.trainerId) q = q.eq("trainer_id", data.trainerId);
      return q.order("paid_on", { ascending: false }).order("id").range(f, t);
    });
    const ids = payouts.map((p) => p.id as string);
    const items = await fetchIn<{ payout_id: string }>(ids, (chunk, f, t) =>
      supabaseAdmin
        .from("trainer_payout_items")
        .select("id,payout_id")
        .in("payout_id", chunk)
        .order("id")
        .range(f, t),
    );
    const counts = new Map<string, number>();
    for (const i of items) counts.set(i.payout_id, (counts.get(i.payout_id) ?? 0) + 1);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,first_name,last_name,email")
      .in(
        "id",
        Array.from(
          new Set(
            payouts
              .flatMap((p) => [p.trainer_id, p.created_by, p.approved_by, p.cancel_requested_by])
              .filter(Boolean),
          ),
        ) as string[],
      );
    const names = new Map((profiles ?? []).map((p) => [p.id as string, nameOf(p)]));
    return {
      payouts: payouts.map((p) => ({
        id: p.id,
        status: (p.status ?? "approved") as PayoutStatus,
        createdBy: p.created_by ?? null,
        createdByName: p.created_by ? (names.get(p.created_by) ?? null) : null,
        approvedByName: p.approved_by ? (names.get(p.approved_by) ?? null) : null,
        approvedAt: p.approved_at ?? null,
        overrideReason: p.cap_override_reason ?? null,
        trainerId: p.trainer_id,
        trainerName: names.get(p.trainer_id) ?? "Unbekannt",
        paidOn: p.paid_on,
        total: Number(p.total_amount),
        note: p.note ?? null,
        itemCount: counts.get(p.id) ?? 0,
        cancelRequest: p.cancel_requested_by
          ? {
              byId: p.cancel_requested_by,
              byName: names.get(p.cancel_requested_by) ?? null,
              at: p.cancel_requested_at,
              reason: p.cancel_reason ?? null,
            }
          : null,
      })),
    };
  });

/**
 * Daten für die Jahresbescheinigung. Vorstand/Admin dürfen jede Trainer:in abrufen, Trainer:innen nur die
 * eigene (dann ohne Angabe von `trainerId`).
 */
export const getPayoutCertificate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        year: z.number().int().min(2020).max(2100),
        trainerId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<Certificate> => {
    const trainerId = data.trainerId ?? context.userId;
    if (trainerId !== context.userId) await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payouts, error } = await (supabaseAdmin as any)
      .from("trainer_payouts")
      .select("id,paid_on,total_amount,note,status")
      .eq("trainer_id", trainerId)
      .gte("paid_on", `${data.year}-01-01`)
      .lte("paid_on", `${data.year}-12-31`)
      .order("paid_on");
    if (error) throw new Error("Auszahlungen konnten nicht geladen werden.");
    // Bescheinigt wird nur, was eine zweite Person freigegeben hat
    const allPayouts = payouts ?? [];
    const approved = allPayouts.filter(
      (p: any) => ((p as any).status ?? "approved") === "approved",
    );
    const pendingCount = allPayouts.length - approved.length;
    const items = await fetchIn<any>(
      approved.map((p: any) => p.id as string),
      (chunk, f, t) =>
        supabaseAdmin
          .from("trainer_payout_items")
          .select("payout_id,session_date,course_name,hours_billed,hourly_rate,amount")
          .in("payout_id", chunk)
          .order("session_date")
          .order("id")
          .range(f, t),
    );
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("first_name,last_name,email")
      .eq("id", trainerId)
      .maybeSingle();
    const mapped: MyPayout[] = approved.map((p: any) => ({
      id: p.id as string,
      status: "approved" as const,
      paidOn: p.paid_on as string,
      total: Number(p.total_amount),
      note: (p.note as string | null) ?? null,
      items: items
        .filter((i) => i.payout_id === p.id)
        .map((i) => ({
          sessionDate: i.session_date,
          courseName: i.course_name,
          hours: Number(i.hours_billed),
          rate: Number(i.hourly_rate),
          amount: Number(i.amount),
        })),
    }));
    if (trainerId !== context.userId) {
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit(null, context.userId, {
        action: "trainer.certificate.viewed",
        entity: "trainer_payouts",
        entity_id: trainerId,
        metadata: { year: data.year },
      });
    }
    const trainerName = nameOf(profile ?? undefined);
    return {
      trainerName,
      year: data.year,
      total: Math.round(mapped.reduce((s, p) => s + p.total, 0) * 100) / 100,
      payouts: mapped,
      signers: certificateSigners(trainerName, CERT_BOARD, CERT_TREASURER),
      pendingCount,
    };
  });

/**
 * Auszahlung freigeben (zweite Person). Wer sie angelegt hat oder sie selbst bekommt, darf nicht
 * freigeben – so prüfen immer zwei Personen, und niemand gibt sich selbst Geld frei.
 */
export const approveTrainerPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await (supabaseAdmin as any)
      .from("trainer_payouts")
      .select("id,trainer_id,created_by,status,total_amount,paid_on")
      .eq("id", data.id)
      .maybeSingle();
    if (!p) throw new Error("Auszahlung nicht gefunden.");
    if (p.status === "approved") throw new Error("Diese Auszahlung ist bereits freigegeben.");
    if (p.trainer_id === context.userId)
      throw new Error("Eine eigene Auszahlung kann nur jemand anderes freigeben.");
    if (p.created_by === context.userId)
      throw new Error("Wer die Auszahlung angelegt hat, kann sie nicht selbst freigeben.");
    const { error } = await (supabaseAdmin as any)
      .from("trainer_payouts")
      .update({
        status: "approved",
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error("Freigabe konnte nicht gespeichert werden.");
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(null, context.userId, {
      action: "trainer.payout.approved",
      entity: "trainer_payouts",
      entity_id: data.id,
      metadata: { trainer_id: p.trainer_id, total: Number(p.total_amount), paid_on: p.paid_on },
    });
    return { ok: true as const };
  });

/** Beleg einer Auszahlung (Einsatzliste, wer angelegt und wer freigegeben hat) für die Kassenprüfung. */
export const getPayoutReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await (supabaseAdmin as any)
      .from("trainer_payouts")
      .select(
        "id,trainer_id,paid_on,total_amount,note,status,created_by,created_at,approved_by,approved_at,cap_override_reason",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!p) throw new Error("Auszahlung nicht gefunden.");
    const { data: items } = await supabaseAdmin
      .from("trainer_payout_items")
      .select("session_date,course_name,hours_billed,hourly_rate,amount")
      .eq("payout_id", data.id)
      .order("session_date");
    const ids = [p.trainer_id, p.created_by, p.approved_by].filter(Boolean) as string[];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,first_name,last_name,email")
      .in("id", ids);
    const names = new Map((profiles ?? []).map((x) => [x.id as string, nameOf(x)]));
    // Bankverbindung, die die Trainer:in unter „Ich“ hinterlegt hat (aktueller Stand, mit Änderungsdatum).
    const { data: bank } = await supabaseAdmin
      .from("trainer_payout_details")
      .select("iban,account_holder,updated_at")
      .eq("user_id", p.trainer_id)
      .maybeSingle();
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(null, context.userId, {
      action: "trainer.payout.receipt",
      entity: "trainer_payouts",
      entity_id: data.id,
      metadata: { trainer_id: p.trainer_id, with_iban: Boolean(bank) },
    });
    return {
      id: p.id as string,
      trainerName: names.get(p.trainer_id) ?? "Unbekannt",
      bank: bank
        ? {
            iban: bank.iban as string,
            holder: bank.account_holder as string,
            updatedAt: (bank.updated_at as string | null) ?? null,
          }
        : null,
      paidOn: p.paid_on as string,
      total: Number(p.total_amount),
      note: (p.note as string | null) ?? null,
      status: (p.status ?? "approved") as PayoutStatus,
      createdByName: p.created_by ? (names.get(p.created_by) ?? null) : null,
      createdAt: (p.created_at as string | null) ?? null,
      approvedByName: p.approved_by ? (names.get(p.approved_by) ?? null) : null,
      approvedAt: (p.approved_at as string | null) ?? null,
      overrideReason: (p.cap_override_reason as string | null) ?? null,
      items: (items ?? []).map((i) => ({
        sessionDate: i.session_date as string,
        courseName: i.course_name as string,
        hours: Number(i.hours_billed),
        rate: Number(i.hourly_rate),
        amount: Number(i.amount),
      })),
    };
  });
export type PayoutReceipt = Awaited<ReturnType<typeof getPayoutReceipt>>;

/** Eigene Jahreserklärung lesen (Trainer:in). */
export const getMyDeclaration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ year: z.number().int().min(2020).max(2100) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<Declaration | null> => {
    await assertTrainer(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: d } = await (supabaseAdmin as any)
      .from("trainer_declarations")
      .select("year,side_job,other_allowance,other_note,confirmed_at")
      .eq("trainer_id", context.userId)
      .eq("year", data.year)
      .maybeSingle();
    return d ? mapDeclaration(d) : null;
  });

/** Jahreserklärung abgeben bzw. ändern (mit Zeitstempel; jede Änderung im Verwaltungsprotokoll). */
export const saveMyDeclaration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        year: z.number().int().min(2020).max(2100),
        sideJob: z.boolean(),
        otherAllowance: z.number().min(0).max(100000),
        otherNote: z.string().trim().max(300).optional(),
        confirm: z.literal(true),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<Declaration> => {
    await assertTrainer(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      trainer_id: context.userId,
      year: data.year,
      side_job: data.sideJob,
      other_allowance: Math.round(data.otherAllowance * 100) / 100,
      other_note: data.otherNote || null,
      confirmed_at: new Date().toISOString(),
    };
    const { data: saved, error } = await (supabaseAdmin as any)
      .from("trainer_declarations")
      .upsert(row, { onConflict: "trainer_id,year" })
      .select("year,side_job,other_allowance,other_note,confirmed_at")
      .single();
    if (error || !saved) throw new Error("Erklärung konnte nicht gespeichert werden.");
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(null, context.userId, {
      action: "trainer.declaration.saved",
      entity: "trainer_declarations",
      entity_id: context.userId,
      metadata: { year: data.year, side_job: data.sideJob, other_allowance: row.other_allowance },
    });
    return mapDeclaration(saved);
  });

export type DeclarationRow = {
  trainerId: string;
  name: string;
  email: string | null;
  /** null = für das Jahr nicht abgegeben */
  declaration: Declaration | null;
};

/** Vorstand: Jahreserklärungen aller Trainer:innen für ein Jahr (fehlende sind erkennbar). */
export const listDeclarations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ year: z.number().int().min(2020).max(2100) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ year: number; rows: DeclarationRow[] }> => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: roleRows }, declRows] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "trainer"),
      fetchAll<any>((f, t) =>
        (supabaseAdmin as any)
          .from("trainer_declarations")
          .select("trainer_id,year,side_job,other_allowance,other_note,confirmed_at")
          .eq("year", data.year)
          .order("id")
          .range(f, t),
      ),
    ]);
    const declBy = new Map<string, Declaration>(
      declRows.map((d) => [d.trainer_id as string, mapDeclaration(d)]),
    );
    // Aktive Trainer:innen (Rolle) plus alle, die schon eine Erklärung abgegeben haben
    const ids = Array.from(
      new Set([...(roleRows ?? []).map((r) => r.user_id as string), ...declBy.keys()]),
    );
    if (ids.length === 0) return { year: data.year, rows: [] };
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,first_name,last_name,email")
      .in("id", ids);
    const profileBy = new Map((profiles ?? []).map((p) => [p.id as string, p]));
    const rows = ids
      .map((id) => ({
        trainerId: id,
        name: nameOf(profileBy.get(id)),
        email: (profileBy.get(id)?.email as string | null) ?? null,
        declaration: declBy.get(id) ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
    return { year: data.year, rows };
  });
