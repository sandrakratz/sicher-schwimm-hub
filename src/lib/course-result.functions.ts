import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchAll } from "@/lib/fetch-all";

export type CourseCost = {
  id: string;
  label: string;
  amount: number;
  paidOn: string | null;
  note: string | null;
};

export type CourseResult = {
  courseId: string;
  name: string;
  firstDate: string | null;
  lastDate: string | null;
  /** Letzter Kurstag vorbei und alle bestätigten Einsätze ausgezahlt */
  finished: boolean;
  /** Bestätigte Einsätze, die noch nicht ausgezahlt wurden */
  unpaidSessions: number;
  participants: number;
  /** Eingegangene Kursgebühren (bezahlte Anmeldungen) */
  incomePaid: number;
  paidCount: number;
  /** Noch offene Kursgebühren bestätigter Teilnehmer:innen */
  incomeOpen: number;
  openCount: number;
  trainerCosts: number;
  costs: CourseCost[];
};

async function assertStaff(supabase: any, userId: string) {
  const { data: isStaff } = await supabase.rpc("is_staff", { _user_id: userId });
  if (!isStaff) throw new Response("Forbidden", { status: 403 });
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Pro Kurs: Einnahmen, Übungsleitergelder, erfasste Kosten. Alle Kurse mit Terminen. */
export const getCourseResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ results: CourseResult[] }> => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(
      new Date(),
    );

    const [courses, sessions, attendance, items, participants, costs] = await Promise.all([
      fetchAll<any>((f, t) =>
        supabaseAdmin.from("courses").select("id,name").order("id").range(f, t),
      ),
      fetchAll<any>((f, t) =>
        supabaseAdmin
          .from("course_sessions")
          .select("id,course_id,session_date")
          .order("id")
          .range(f, t),
      ),
      fetchAll<any>((f, t) =>
        supabaseAdmin
          .from("trainer_session_attendance")
          .select("id,session_id,trainer_id")
          .eq("present", true)
          .not("confirmed_at", "is", null)
          .order("id")
          .range(f, t),
      ),
      fetchAll<any>((f, t) =>
        supabaseAdmin
          .from("trainer_payout_items")
          .select("id,session_id,trainer_id,amount")
          .order("id")
          .range(f, t),
      ),
      fetchAll<any>((f, t) =>
        supabaseAdmin
          .from("course_participants")
          .select("id,course_id,status,paid,price_amount")
          .neq("status", "waiting")
          .order("id")
          .range(f, t),
      ),
      fetchAll<any>((f, t) =>
        supabaseAdmin.from("course_costs" as any).select("*").order("id").range(f, t),
      ),
    ]);

    const courseOfSession = new Map<string, string>(
      sessions.map((s) => [s.id as string, s.course_id as string]),
    );
    const paidKeys = new Set(items.map((i) => `${i.session_id}:${i.trainer_id}`));

    type Acc = Omit<CourseResult, "name" | "finished">;
    const acc = new Map<string, Acc>();
    const get = (id: string): Acc => {
      let a = acc.get(id);
      if (!a) {
        a = {
          courseId: id,
          firstDate: null,
          lastDate: null,
          unpaidSessions: 0,
          participants: 0,
          incomePaid: 0,
          paidCount: 0,
          incomeOpen: 0,
          openCount: 0,
          trainerCosts: 0,
          costs: [],
        };
        acc.set(id, a);
      }
      return a;
    };

    for (const s of sessions) {
      const a = get(s.course_id);
      const d = s.session_date as string;
      if (!a.firstDate || d < a.firstDate) a.firstDate = d;
      if (!a.lastDate || d > a.lastDate) a.lastDate = d;
    }
    for (const at of attendance) {
      const cid = courseOfSession.get(at.session_id);
      if (cid && !paidKeys.has(`${at.session_id}:${at.trainer_id}`)) get(cid).unpaidSessions += 1;
    }
    for (const i of items) {
      const cid = courseOfSession.get(i.session_id);
      if (cid) get(cid).trainerCosts += Number(i.amount);
    }
    for (const p of participants) {
      const a = get(p.course_id);
      const price = Number(p.price_amount ?? 0);
      if (p.paid) {
        a.paidCount += 1;
        a.incomePaid += price;
        if (p.status === "confirmed") a.participants += 1;
      } else if (p.status === "confirmed") {
        a.participants += 1;
        a.openCount += 1;
        a.incomeOpen += price;
      }
    }
    for (const c of costs) {
      get(c.course_id).costs.push({
        id: c.id,
        label: c.label,
        amount: Number(c.amount),
        paidOn: c.paid_on,
        note: c.note,
      });
    }

    const nameById = new Map(courses.map((c) => [c.id as string, c.name as string]));
    const results: CourseResult[] = [];
    for (const a of acc.values()) {
      const name = nameById.get(a.courseId);
      if (!name || !a.lastDate) continue; // nur Kurse mit Terminen
      results.push({
        ...a,
        name,
        incomePaid: round2(a.incomePaid),
        incomeOpen: round2(a.incomeOpen),
        trainerCosts: round2(a.trainerCosts),
        finished: a.lastDate < today && a.unpaidSessions === 0,
      });
    }
    results.sort((x, y) => (y.lastDate ?? "").localeCompare(x.lastDate ?? ""));
    return { results };
  });

export const saveCourseCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        courseId: z.string().uuid(),
        label: z.string().trim().min(1).max(80),
        amount: z.number().min(0).max(100000),
        paidOn: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional(),
        note: z.string().trim().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      course_id: data.courseId,
      label: data.label,
      amount: round2(data.amount),
      paid_on: data.paidOn || null,
      note: data.note || null,
    };
    const { error } = data.id
      ? await supabaseAdmin
          .from("course_costs" as any)
          .update(row)
          .eq("id", data.id)
      : await supabaseAdmin
          .from("course_costs" as any)
          .insert({ ...row, created_by: context.userId });
    if (error) throw new Error("Kosten konnten nicht gespeichert werden.");
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(null, context.userId, {
      action: "course.cost.saved",
      entity: "course_costs",
      entity_id: data.id ?? data.courseId,
      metadata: { label: data.label, amount: row.amount },
    });
    return { ok: true };
  });

export const deleteCourseCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("course_costs" as any)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error("Kosten konnten nicht gelöscht werden.");
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(null, context.userId, {
      action: "course.cost.deleted",
      entity: "course_costs",
      entity_id: data.id,
    });
    return { ok: true };
  });
