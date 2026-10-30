import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchAll, fetchIn } from "@/lib/fetch-all";
import { amountOf, pickRate, resolveHours, type Rate } from "@/lib/trainer-billing";

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
  /** Im laufenden Jahr bereits ausgezahlt je Trainer:in (Freibetrag zählt nach Auszahlungsdatum) */
  paidInYear: Record<string, number>;
  year: number;
};

export type MyPayout = {
  id: string;
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

async function assertStaff(supabase: any, userId: string) {
  const { data: isStaff } = await supabase.rpc("is_staff", { _user_id: userId });
  if (!isStaff) throw new Response("Forbidden", { status: 403 });
}

function nameOf(p?: { first_name: string | null; last_name: string | null; email: string | null }) {
  return [p?.first_name, p?.last_name].filter(Boolean).join(" ") || p?.email || "Unbekannt";
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum ungültig");

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
    await assertStaff(context.supabase, context.userId);
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
    const year = Number(
      new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }).slice(0, 4),
    );
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
    await assertStaff(context.supabase, context.userId);
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
    await assertStaff(context.supabase, context.userId);
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
    await assertStaff(context.supabase, context.userId);
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
      })
      .parse(input),
  )
  .handler(
    async ({ context, data }): Promise<{ payoutId: string; total: number; count: number }> => {
      await assertStaff(context.supabase, context.userId);
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
      const { data: payout, error } = await supabaseAdmin
        .from("trainer_payouts")
        .insert({
          trainer_id: data.trainerId,
          paid_on: data.paidOn,
          total_amount: total,
          note: data.note || null,
          created_by: context.userId,
        })
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
        metadata: { trainer_id: data.trainerId, total, count: items.length, paid_on: data.paidOn },
      });
      return { payoutId: payout.id, total, count: items.length };
    },
  );

/** Auszahlung rückgängig machen (z. B. Fehlbuchung); die Termine sind danach wieder offen. */
export const deleteTrainerPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payout } = await supabaseAdmin
      .from("trainer_payouts")
      .select("trainer_id,total_amount,paid_on")
      .eq("id", data.id)
      .maybeSingle();
    if (!payout) throw new Error("Auszahlung nicht gefunden.");
    const { error } = await supabaseAdmin.from("trainer_payouts").delete().eq("id", data.id);
    if (error) throw new Error("Auszahlung konnte nicht gelöscht werden.");
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(null, context.userId, {
      action: "trainer.payout.deleted",
      entity: "trainer_payouts",
      entity_id: data.id,
      metadata: payout,
    });
    return { ok: true };
  });

/** Eigene Auszahlungen eines Jahres (Trainer:in sieht, was ihr wann ausgezahlt wurde). */
export const getMyPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ year: z.number().int().min(2020).max(2100) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ payouts: MyPayout[] }> => {
    const { data: payouts, error } = await context.supabase
      .from("trainer_payouts")
      .select("id,paid_on,total_amount,note")
      .eq("trainer_id", context.userId)
      .gte("paid_on", `${data.year}-01-01`)
      .lte("paid_on", `${data.year}-12-31`)
      .order("paid_on", { ascending: false });
    if (error) throw new Error("Auszahlungen konnten nicht geladen werden.");
    const ids = (payouts ?? []).map((p) => p.id as string);
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
      payouts: (payouts ?? []).map((p) => ({
        id: p.id as string,
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
  trainerId: string;
  trainerName: string;
  paidOn: string;
  total: number;
  note: string | null;
  /** Anzahl der verknüpften Termine; 0 = nachträglich erfasste Auszahlung ohne Termine */
  itemCount: number;
};

export type Certificate = {
  trainerName: string;
  year: number;
  total: number;
  payouts: MyPayout[];
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
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const amount = Math.round(data.amount * 100) / 100;
    const { data: payout, error } = await supabaseAdmin
      .from("trainer_payouts")
      .insert({
        trainer_id: data.trainerId,
        paid_on: data.paidOn,
        total_amount: amount,
        note: data.note || "Nachträglich erfasst",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !payout) throw new Error("Auszahlung konnte nicht gespeichert werden.");
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(null, context.userId, {
      action: "trainer.payout.manual",
      entity: "trainer_payouts",
      entity_id: payout.id,
      metadata: { trainer_id: data.trainerId, amount, paid_on: data.paidOn },
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
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payouts = await fetchAll<any>((f, t) => {
      let q = supabaseAdmin
        .from("trainer_payouts")
        .select("id,trainer_id,paid_on,total_amount,note")
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
      .in("id", Array.from(new Set(payouts.map((p) => p.trainer_id as string))));
    const names = new Map((profiles ?? []).map((p) => [p.id as string, nameOf(p)]));
    return {
      payouts: payouts.map((p) => ({
        id: p.id,
        trainerId: p.trainer_id,
        trainerName: names.get(p.trainer_id) ?? "Unbekannt",
        paidOn: p.paid_on,
        total: Number(p.total_amount),
        note: p.note ?? null,
        itemCount: counts.get(p.id) ?? 0,
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
    if (trainerId !== context.userId) await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payouts, error } = await supabaseAdmin
      .from("trainer_payouts")
      .select("id,paid_on,total_amount,note")
      .eq("trainer_id", trainerId)
      .gte("paid_on", `${data.year}-01-01`)
      .lte("paid_on", `${data.year}-12-31`)
      .order("paid_on");
    if (error) throw new Error("Auszahlungen konnten nicht geladen werden.");
    const items = await fetchIn<any>(
      (payouts ?? []).map((p) => p.id as string),
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
    const mapped: MyPayout[] = (payouts ?? []).map((p) => ({
      id: p.id as string,
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
    return {
      trainerName: nameOf(profile ?? undefined),
      year: data.year,
      total: Math.round(mapped.reduce((s, p) => s + p.total, 0) * 100) / 100,
      payouts: mapped,
    };
  });
