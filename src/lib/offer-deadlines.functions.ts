import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_OFFER_DEADLINES, type OfferDeadlineSettings } from "@/lib/offer-deadline";

async function assertManager(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (!data) throw new Error("Forbidden");
}

export type OfferDeadlineCourse = {
  id: string;
  name: string;
  program_name: string | null;
  starts_on: string | null;
  status: string;
  offer_days_override: number | null;
};

/** Regel (Kursbeginn nah/fern) und alle laufenden bzw. kommenden Kurszeiträume für die Tabelle. */
export const getOfferDeadlines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin
      .from("offer_deadline_settings")
      .select("far_weeks,days_far,days_near")
      .eq("id", true)
      .maybeSingle();
    const settings: OfferDeadlineSettings = s ?? DEFAULT_OFFER_DEADLINES;
    const { data: rows, error } = await supabaseAdmin
      .from("courses")
      .select("id,name,starts_on,status,offer_days_override,program_id,course_programs(name)")
      .is("archived_at", null)
      .neq("status", "completed")
      .order("starts_on", { ascending: true, nullsFirst: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    const courses: OfferDeadlineCourse[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      program_name: r.course_programs?.name ?? null,
      starts_on: r.starts_on,
      status: r.status,
      offer_days_override: r.offer_days_override,
    }));
    return { settings, courses };
  });

const saveSchema = z.object({
  settings: z.object({
    far_weeks: z.number().int().min(1).max(52),
    days_far: z.number().int().min(1).max(60),
    days_near: z.number().int().min(1).max(60),
  }),
  overrides: z
    .array(
      z.object({
        id: z.string().uuid(),
        days: z.number().int().min(1).max(60).nullable(),
      }),
    )
    .max(1000),
});

/** Speichert die Regel und die eigenen Fristen (nur geänderte Kurszeiträume werden mitgeschickt). */
export const saveOfferDeadlines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("offer_deadline_settings")
      .upsert({
        id: true,
        ...data.settings,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      });
    if (error) throw new Error(error.message);
    for (const o of data.overrides) {
      const { error: e } = await supabaseAdmin
        .from("courses")
        .update({ offer_days_override: o.days })
        .eq("id", o.id);
      if (e) throw new Error(e.message);
    }
    return { ok: true };
  });
