/* eslint-disable @typescript-eslint/no-explicit-any -- neue Tabellen sind noch nicht in den generierten Typen */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchAll, fetchIn } from "@/lib/fetch-all";
import { parseTimeRange } from "@/lib/ics";
import { todayBerlinIso } from "@/lib/format";
import { logAudit } from "@/lib/audit.server";
import {
  shortDate,
  overlaps,
  sessionLabel,
  type PlanBlackout,
  type PlanData,
  type PlanSession,
  type PlanTrainer,
} from "@/lib/dienstplan";

const SITE = "https://sicher-schwimmen.com";

type Ctx = { supabase: any; userId: string };

async function isStaff(context: Ctx): Promise<boolean> {
  const { data } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  return !!data;
}

async function assertStaff(context: Ctx) {
  if (!(await isStaff(context))) throw new Error("Forbidden");
}

/** Vorstand/Verwaltung oder Trainer:in. */
async function assertTeam(context: Ctx) {
  if (await isStaff(context)) return;
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "trainer",
  });
  if (!data) throw new Error("Forbidden");
}

const fullName = (p: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) => [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.email || "Unbekannt";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function profileOf(db: any, id: string): Promise<PlanTrainer> {
  const { data } = await db
    .from("profiles")
    .select("id,first_name,last_name,email")
    .eq("id", id)
    .maybeSingle();
  return { id, name: data ? fullName(data) : "Unbekannt", email: data?.email ?? "" };
}

/** Alle Personen, die Termine übernehmen können (Trainer, Admin, Vorstand). */
async function loadTrainerList(db: any): Promise<PlanTrainer[]> {
  const { data: roleRows, error } = await db
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "board", "trainer"]);
  if (error) throw new Error(error.message);
  const ids: string[] = [...new Set<string>((roleRows ?? []).map((r: any) => r.user_id as string))];
  const profiles = await fetchIn<any>(ids, (chunk, f, t) =>
    db
      .from("profiles")
      .select("id,first_name,last_name,email")
      .in("id", chunk)
      .order("id")
      .range(f, t),
  );
  return profiles
    .map((p) => ({ id: p.id as string, name: fullName(p), email: (p.email as string) ?? "" }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

const SESSION_SELECT =
  "id,course_id,session_index,session_date,start_time,end_time,assigned_trainer_id,replacement_requested_at," +
  "courses!inner(name,location,schedule,duration,trainer_id,trainers_needed,archived_at)";

function toPlanSession(row: any): PlanSession {
  const c = row.courses ?? {};
  const fallback = parseTimeRange(c.schedule, c.duration);
  return {
    id: row.id,
    courseId: row.course_id,
    courseName: c.name ?? "Kurs",
    location: c.location ?? null,
    date: row.session_date,
    start: row.start_time ? String(row.start_time).slice(0, 5) : (fallback?.start ?? null),
    end: row.end_time ? String(row.end_time).slice(0, 5) : (fallback?.end ?? null),
    index: row.session_index,
    needed: c.trainers_needed ?? 2,
    fixedIds: c.trainer_id ? [c.trainer_id] : [],
    replacementRequestedAt: row.replacement_requested_at ?? null,
  };
}

async function loadSessionsByIds(db: any, ids: string[]) {
  const rows = await fetchIn<any>(ids, (chunk, f, t) =>
    db.from("course_sessions").select(SESSION_SELECT).in("id", chunk).order("id").range(f, t),
  );
  return new Map(
    rows.map((r) => [
      r.id as string,
      { session: toPlanSession(r), legacy: r.assigned_trainer_id as string | null },
    ]),
  );
}

async function loadAssignmentsFor(db: any, sessionIds: string[]) {
  return fetchIn<{ session_id: string; trainer_id: string }>(sessionIds, (chunk, f, t) =>
    db
      .from("course_session_assignments")
      .select("session_id,trainer_id")
      .in("session_id", chunk)
      .order("id")
      .range(f, t),
  );
}

async function writeLog(
  db: any,
  rows: {
    action: string;
    session?: PlanSession | null;
    trainer?: PlanTrainer | null;
    actor: PlanTrainer;
    reason?: string | null;
  }[],
) {
  if (!rows.length) return;
  const { error } = await db.from("dienstplan_log").insert(
    rows.map((r) => ({
      action: r.action,
      session_id: r.session?.id ?? null,
      trainer_id: r.trainer?.id ?? null,
      actor_id: r.actor.id,
      session_label: r.session ? `${r.session.courseName} (${r.session.index}. Termin)` : null,
      session_date: r.session?.date ?? null,
      trainer_name: r.trainer?.name ?? null,
      actor_name: r.actor.name,
      reason: r.reason ?? null,
    })),
  );
  if (error) console.error("[dienstplan] Protokoll konnte nicht geschrieben werden", error);
}

async function sendMail(
  templateName: "dienstplan-trainer" | "dienstplan-intern",
  recipientEmail: string | null,
  templateData: Record<string, unknown>,
  key: string,
): Promise<boolean> {
  try {
    const { queueTemplateEmail } = await import("@/lib/email-send.server");
    const res = await queueTemplateEmail({
      templateName,
      recipientEmail,
      templateData,
      idempotencyKey: key,
    });
    return res.queued;
  } catch (err) {
    console.error("[dienstplan] Mail fehlgeschlagen", err);
    return false;
  }
}

/** Entfernt Einteilungen (auch die alte Einzelzuordnung am Termin). Fest zugeordnete Kurstrainer:innen bleiben. */
async function removeAssignments(db: any, trainerId: string, sessionIds: string[]) {
  if (!sessionIds.length) return;
  const del = await db
    .from("course_session_assignments")
    .delete()
    .eq("trainer_id", trainerId)
    .in("session_id", sessionIds);
  if (del.error) throw new Error(del.error.message);
  const legacy = await db
    .from("course_sessions")
    .update({ assigned_trainer_id: null })
    .eq("assigned_trainer_id", trainerId)
    .in("id", sessionIds);
  if (legacy.error) throw new Error(legacy.error.message);
}

/** Aktuelle Besetzung je Termin (Einteilungen + feste Zuordnung). */
async function teamSizes(db: any, sessions: PlanSession[], legacy: Map<string, string | null>) {
  const rows = await loadAssignmentsFor(
    db,
    sessions.map((s) => s.id),
  );
  const team = new Map<string, Set<string>>();
  for (const s of sessions) {
    const set = new Set<string>(s.fixedIds);
    const l = legacy.get(s.id);
    if (l) set.add(l);
    team.set(s.id, set);
  }
  for (const r of rows) team.get(r.session_id)?.add(r.trainer_id);
  return team;
}

/** Wenn ein Termin wieder voll ist, wird „Ersatz gesucht“ zurückgenommen. */
async function clearRequestsIfFull(
  db: any,
  sessions: PlanSession[],
  team: Map<string, Set<string>>,
) {
  const full = sessions
    .filter((s) => s.replacementRequestedAt && (team.get(s.id)?.size ?? 0) >= s.needed)
    .map((s) => s.id);
  if (full.length)
    await db.from("course_sessions").update({ replacement_requested_at: null }).in("id", full);
}

// ---------------------------------------------------------------------------------------------
// Planungsdaten (Vorstand)
// ---------------------------------------------------------------------------------------------

/** Alle Termine ab Monatsanfang mit Besetzung, Rückmeldungen und Sperrzeiten – Grundlage für Lücken, Wochenplan und Vorschlag. */
export const loadPlanningData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        from: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<PlanData> => {
    await assertStaff(context);
    const db = await admin();
    const today = todayBerlinIso();
    const from = data.from ?? `${today.slice(0, 7)}-01`;

    const rows = await fetchAll<any>((f, t) =>
      db
        .from("course_sessions")
        .select(SESSION_SELECT)
        .is("courses.archived_at", null)
        .gte("session_date", from)
        .order("session_date", { ascending: true })
        .order("id")
        .range(f, t),
    );
    const sessions = rows.map(toPlanSession);
    const ids = sessions.map((s) => s.id);
    const [assignRows, availRows, blackoutRows, trainers] = await Promise.all([
      loadAssignmentsFor(db, ids),
      fetchIn<any>(ids, (chunk, f, t) =>
        db
          .from("course_session_availability")
          .select("session_id,trainer_id,available")
          .in("session_id", chunk)
          .order("id")
          .range(f, t),
      ),
      fetchAll<any>((f, t) =>
        db.from("trainer_blackouts").select("*").gte("date_to", from).order("id").range(f, t),
      ),
      loadTrainerList(db),
    ]);

    const assignments = assignRows.map((a) => ({
      sessionId: a.session_id,
      trainerId: a.trainer_id,
    }));
    // Alte Einzelzuordnung am Termin zählt wie eine Einteilung
    const have = new Set(assignments.map((a) => `${a.sessionId}|${a.trainerId}`));
    for (const r of rows) {
      if (r.assigned_trainer_id && !have.has(`${r.id}|${r.assigned_trainer_id}`))
        assignments.push({ sessionId: r.id, trainerId: r.assigned_trainer_id });
    }

    const blackouts: PlanBlackout[] = blackoutRows.map((b) => ({
      id: b.id,
      trainerId: b.trainer_id,
      from: b.date_from,
      to: b.date_to,
      weekdays: b.weekdays ?? null,
      note: b.note ?? null,
    }));

    return {
      sessions,
      trainers,
      assignments,
      availability: availRows.map((a) => ({
        sessionId: a.session_id,
        trainerId: a.trainer_id,
        available: !!a.available,
      })),
      blackouts,
    };
  });

// ---------------------------------------------------------------------------------------------
// Einteilen / Ausplanen durch den Vorstand
// ---------------------------------------------------------------------------------------------

const applySchema = z.object({
  changes: z
    .array(
      z.object({ sessionId: z.string().uuid(), trainerId: z.string().uuid(), on: z.boolean() }),
    )
    .min(1)
    .max(400),
  /** Betroffene Trainer:innen per Mail informieren (nur bei zukünftigen Terminen). */
  notify: z.boolean().default(true),
});

export const applyAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => applySchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await admin();
    const today = todayBerlinIso();
    const actor = await profileOf(db, context.userId);

    const sessionIds = [...new Set(data.changes.map((c) => c.sessionId))];
    const sessions = await loadSessionsByIds(db, sessionIds);
    const existing = await loadAssignmentsFor(db, sessionIds);
    const has = new Set(existing.map((a) => `${a.session_id}|${a.trainer_id}`));
    for (const [id, s] of sessions) if (s.legacy) has.add(`${id}|${s.legacy}`);

    const adds = data.changes.filter((c) => c.on && !has.has(`${c.sessionId}|${c.trainerId}`));
    const removes = data.changes.filter((c) => !c.on && has.has(`${c.sessionId}|${c.trainerId}`));

    if (adds.length) {
      const { error } = await db.from("course_session_assignments").upsert(
        adds.map((c) => ({
          session_id: c.sessionId,
          trainer_id: c.trainerId,
          created_by: context.userId,
        })),
        { onConflict: "session_id,trainer_id", ignoreDuplicates: true },
      );
      if (error) throw new Error(error.message);
    }
    const byTrainer = new Map<string, string[]>();
    for (const c of removes)
      byTrainer.set(c.trainerId, [...(byTrainer.get(c.trainerId) ?? []), c.sessionId]);
    for (const [trainerId, ids] of byTrainer) await removeAssignments(db, trainerId, ids);

    const trainerIds = [...new Set([...adds, ...removes].map((c) => c.trainerId))];
    const trainers = new Map<string, PlanTrainer>();
    for (const id of trainerIds) trainers.set(id, await profileOf(db, id));

    await writeLog(db, [
      ...adds.map((c) => ({
        action: "assigned",
        session: sessions.get(c.sessionId)?.session,
        trainer: trainers.get(c.trainerId),
        actor,
      })),
      ...removes.map((c) => ({
        action: "unassigned",
        session: sessions.get(c.sessionId)?.session,
        trainer: trainers.get(c.trainerId),
        actor,
      })),
    ]);

    // „Ersatz gesucht“ zurücknehmen, wenn der Termin jetzt voll ist
    const list = [...sessions.values()].map((s) => s.session);
    const legacy = new Map([...sessions].map(([id, s]) => [id, s.legacy]));
    await clearRequestsIfFull(db, list, await teamSizes(db, list, legacy));

    // Eine Mail je Trainer:in (nicht je Termin)
    let mailed = 0;
    if (data.notify) {
      for (const [trainerId, t] of trainers) {
        if (trainerId === context.userId || !t.email) continue;
        const future = (kind: typeof adds) =>
          kind
            .filter((c) => c.trainerId === trainerId)
            .map((c) => sessions.get(c.sessionId)?.session)
            .filter((s): s is PlanSession => !!s && s.date >= today)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(sessionLabel);
        const sections = [
          { title: "Du bist eingeteilt", items: future(adds) },
          { title: "Dein Einsatz entfällt", items: future(removes) },
        ].filter((s) => s.items.length);
        if (!sections.length) continue;
        const ok = await sendMail(
          "dienstplan-trainer",
          t.email,
          {
            name: t.name.split(" ")[0],
            heading: "Dienstplan geändert",
            subject: sections.some((s) => s.title === "Du bist eingeteilt")
              ? "Dienstplan: Du bist eingeteilt"
              : "Dienstplan: Dein Einsatz entfällt",
            intro: `${actor.name} hat den Dienstplan angepasst:`,
            sections,
            url: `${SITE}/trainer/verfuegbarkeit`,
            button: "Meine Einsätze ansehen",
          },
          `dienstplan-${trainerId}-${crypto.randomUUID()}`,
        );
        if (ok) mailed += 1;
      }
    }

    await logAudit(context.supabase, context.userId, {
      action: "dienstplan.changed",
      entity: "course_session_assignments",
      metadata: { added: adds.length, removed: removes.length },
    });
    return { added: adds.length, removed: removes.length, mailed };
  });

// ---------------------------------------------------------------------------------------------
// Absage (durch die Trainer:in selbst oder telefonisch durch den Vorstand erfasst)
// ---------------------------------------------------------------------------------------------

const withdrawSchema = z.object({
  sessionIds: z.array(z.string().uuid()).min(1).max(100),
  reason: z.string().trim().min(2, "Bitte einen kurzen Grund angeben").max(300),
  /** Nur der Vorstand darf für jemand anderen absagen (telefonische Absage). */
  trainerId: z.string().uuid().optional(),
});

export const withdrawFromSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => withdrawSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertTeam(context);
    const staff = await isStaff(context);
    const targetId = data.trainerId ?? context.userId;
    const byStaff = targetId !== context.userId;
    if (byStaff && !staff) throw new Error("Forbidden");

    const db = await admin();
    const today = todayBerlinIso();
    const actor = await profileOf(db, context.userId);
    const target = byStaff ? await profileOf(db, targetId) : actor;

    const loaded = await loadSessionsByIds(db, [...new Set(data.sessionIds)]);
    const sessions = [...loaded.values()].map((s) => s.session).filter((s) => s.date >= today);
    if (!sessions.length) throw new Error("Für vergangene Termine ist keine Absage mehr nötig.");

    const assigned = await loadAssignmentsFor(
      db,
      sessions.map((s) => s.id),
    );
    const mine = new Set(
      assigned.filter((a) => a.trainer_id === targetId).map((a) => a.session_id),
    );
    for (const s of sessions) if (loaded.get(s.id)?.legacy === targetId) mine.add(s.id);

    // Fest zugeordnete Kurstrainer:innen lassen sich hier nicht abmelden
    const skipped = sessions.filter((s) => s.fixedIds.includes(targetId));
    const wasAssigned = sessions.filter((s) => mine.has(s.id) && !s.fixedIds.includes(targetId));
    await removeAssignments(
      db,
      targetId,
      wasAssigned.map((s) => s.id),
    );

    // „Kann nicht“ mit Grund vermerken, damit die Person beim Ersatzsuchen unten steht
    const { error: availErr } = await db.from("course_session_availability").upsert(
      sessions
        .filter((s) => !s.fixedIds.includes(targetId))
        .map((s) => ({
          session_id: s.id,
          trainer_id: targetId,
          available: false,
          note: data.reason,
        })),
      { onConflict: "session_id,trainer_id" },
    );
    if (availErr) throw new Error(availErr.message);

    await writeLog(
      db,
      wasAssigned.map((s) => ({
        action: byStaff ? "withdrawn_by_staff" : "withdrawn",
        session: s,
        trainer: target,
        actor,
        reason: data.reason,
      })),
    );

    const legacy = new Map(
      [...loaded].map(([id, s]) => [id, s.legacy === targetId ? null : s.legacy]),
    );
    const team = await teamSizes(db, wasAssigned, legacy);
    const gaps = wasAssigned
      .map((s) => ({
        sessionId: s.id,
        label: sessionLabel(s),
        have: team.get(s.id)?.size ?? 0,
        needed: s.needed,
      }))
      .filter((g) => g.have < g.needed);

    // Der Vorstand wird informiert, wenn die Absage von der Trainer:in selbst kommt
    let mailed = false;
    if (!byStaff && wasAssigned.length) {
      mailed = await sendMail(
        "dienstplan-intern",
        null,
        {
          heading: `${target.name} hat abgesagt`,
          subject: `Absage: ${target.name} · ${wasAssigned
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((s) => shortDate(s.date))
            .slice(0, 3)
            .join(", ")}${wasAssigned.length > 3 ? " …" : ""}`,
          intro: `${target.name} kann an ${wasAssigned.length === 1 ? "diesem Termin" : "diesen Terminen"} nicht mehr${
            gaps.length ? ". Dadurch fehlt jemand:" : ":"
          }`,
          items: wasAssigned
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((s) => {
              const g = gaps.find((x) => x.sessionId === s.id);
              return `${sessionLabel(s)}${g ? ` – nur noch ${g.have} von ${g.needed}` : ""}`;
            }),
          reason: data.reason,
          url: `${SITE}/admin/dienstplan`,
        },
        `dienstplan-absage-${targetId}-${crypto.randomUUID()}`,
      );
    }

    await logAudit(context.supabase, context.userId, {
      action: byStaff ? "dienstplan.withdrawn_by_staff" : "dienstplan.withdrawn",
      entity: "course_session_assignments",
      metadata: { trainer: target.name, sessions: wasAssigned.length, reason: data.reason },
    });
    return { removed: wasAssigned.length, gaps, skipped: skipped.length, mailed };
  });

// ---------------------------------------------------------------------------------------------
// Ersatz anfragen (Vorstand löst die Mail aus) und übernehmen (Trainer:in)
// ---------------------------------------------------------------------------------------------

export const requestReplacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        trainerIds: z.array(z.string().uuid()).min(1).max(40),
        note: z.string().trim().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await admin();
    const actor = await profileOf(db, context.userId);
    const loaded = await loadSessionsByIds(db, [data.sessionId]);
    const entry = loaded.get(data.sessionId);
    if (!entry) throw new Error("Termin nicht gefunden");
    const s = entry.session;
    if (s.date < todayBerlinIso()) throw new Error("Der Termin liegt in der Vergangenheit.");

    const team = (await teamSizes(db, [s], new Map([[s.id, entry.legacy]]))).get(s.id) ?? new Set();
    const targets: PlanTrainer[] = [];
    for (const id of new Set(data.trainerIds)) {
      if (team.has(id)) continue;
      targets.push(await profileOf(db, id));
    }

    const { error } = await db
      .from("course_sessions")
      .update({ replacement_requested_at: new Date().toISOString() })
      .eq("id", s.id);
    if (error) throw new Error(error.message);

    let mailed = 0;
    for (const t of targets) {
      if (!t.email) continue;
      const ok = await sendMail(
        "dienstplan-trainer",
        t.email,
        {
          name: t.name.split(" ")[0],
          heading: "Kannst du einspringen?",
          subject: `Ersatz gesucht: ${shortDate(s.date)} · ${s.courseName}`,
          intro:
            "Bei diesem Termin fehlt noch jemand. Wer zuerst „Ich übernehme“ klickt, ist eingeteilt – du findest den Termin im Trainerbereich ganz oben unter „Ersatz gesucht“.",
          sections: [{ title: "Ersatz gesucht", items: [sessionLabel(s)] }],
          note: data.note ?? null,
          url: `${SITE}/trainer/verfuegbarkeit`,
          button: "Termin ansehen und übernehmen",
        },
        `dienstplan-ersatz-${s.id}-${t.id}-${Date.now()}`,
      );
      if (ok) mailed += 1;
    }
    await writeLog(
      db,
      targets.map((t) => ({
        action: "replacement_requested",
        session: s,
        trainer: t,
        actor,
        reason: data.note ?? null,
      })),
    );
    return { asked: targets.length, mailed };
  });

export const claimSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertTeam(context);
    const db = await admin();
    const me = await profileOf(db, context.userId);
    const loaded = await loadSessionsByIds(db, [data.sessionId]);
    const entry = loaded.get(data.sessionId);
    if (!entry) throw new Error("Termin nicht gefunden");
    const s = entry.session;
    if (s.date < todayBerlinIso()) throw new Error("Der Termin liegt in der Vergangenheit.");

    const team = (await teamSizes(db, [s], new Map([[s.id, entry.legacy]]))).get(s.id) ?? new Set();
    if (team.has(context.userId)) throw new Error("Du bist für diesen Termin schon eingeteilt.");
    if (team.size >= s.needed) throw new Error("Der Termin ist inzwischen besetzt.");

    // Nicht zur selben Zeit in einem anderen Kurs
    const { data: mineRows } = await db
      .from("course_session_assignments")
      .select("session_id")
      .eq("trainer_id", context.userId);
    const mineIds = (mineRows ?? []).map((r: any) => r.session_id as string);
    if (mineIds.length) {
      const others = await loadSessionsByIds(db, mineIds);
      const clash = [...others.values()].find(
        (o) => o.session.id !== s.id && overlaps(o.session, s),
      );
      if (clash)
        throw new Error(`Du bist zur selben Zeit schon eingeteilt (${clash.session.courseName}).`);
    }

    const { error } = await db
      .from("course_session_assignments")
      .upsert(
        { session_id: s.id, trainer_id: context.userId, created_by: context.userId },
        { onConflict: "session_id,trainer_id", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);

    // Wer gleichzeitig klickt: der später Eingetragene gibt den Platz wieder frei
    const { data: ordered } = await db
      .from("course_session_assignments")
      .select("trainer_id")
      .eq("session_id", s.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    const order = (ordered ?? []).map((r: any) => r.trainer_id as string);
    const free = Math.max(0, s.needed - s.fixedIds.length);
    if (order.indexOf(context.userId) >= free) {
      await removeAssignments(db, context.userId, [s.id]);
      throw new Error("Der Termin ist inzwischen besetzt.");
    }

    await db
      .from("course_session_availability")
      .upsert(
        { session_id: s.id, trainer_id: context.userId, available: true, note: null },
        { onConflict: "session_id,trainer_id" },
      );
    await writeLog(db, [{ action: "claimed", session: s, trainer: me, actor: me }]);
    const after = await teamSizes(db, [s], new Map([[s.id, entry.legacy]]));
    await clearRequestsIfFull(db, [s], after);

    await sendMail(
      "dienstplan-intern",
      null,
      {
        heading: `${me.name} übernimmt einen Termin`,
        subject: `Übernommen: ${me.name} · ${shortDate(s.date)}`,
        intro: `${me.name} hat den Termin übernommen${
          (after.get(s.id)?.size ?? 0) >= s.needed ? " – er ist wieder voll besetzt:" : ":"
        }`,
        items: [sessionLabel(s)],
        url: `${SITE}/admin/dienstplan`,
      },
      `dienstplan-uebernahme-${s.id}-${context.userId}-${Date.now()}`,
    );
    return { ok: true as const };
  });

// ---------------------------------------------------------------------------------------------
// Protokoll
// ---------------------------------------------------------------------------------------------

export type DienstplanLogRow = {
  id: string;
  createdAt: string;
  action: string;
  sessionLabel: string | null;
  sessionDate: string | null;
  trainerName: string | null;
  actorName: string | null;
  reason: string | null;
};

export const listDienstplanLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(1000).default(300) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<DienstplanLogRow[]> => {
    await assertStaff(context);
    const db = await admin();
    const { data: rows, error } = await db
      .from("dienstplan_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      createdAt: r.created_at,
      action: r.action,
      sessionLabel: r.session_label,
      sessionDate: r.session_date,
      trainerName: r.trainer_name,
      actorName: r.actor_name,
      reason: r.reason,
    }));
  });
