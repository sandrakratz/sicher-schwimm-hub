import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EVENT_SCHEMAS, SERVER_EVENT_SCHEMAS } from "@/lib/analytics/events";
import { analyzeVariants, type VariantResult } from "@/lib/analytics/stats";

export type DashboardData = {
  overview: {
    page_views: number;
    visitors: number;
    sessions: number;
    median_visible_s: number | null;
    avg_scroll_pct: number | null;
  };
  daily: { day: string; views: number; visitors: number }[];
  pages: {
    path: string;
    views: number;
    visitors: number;
    median_visible_s: number | null;
    avg_scroll_pct: number | null;
  }[];
  referrers: { host: string; sessions: number }[];
  devices: { device: string; visitors: number }[];
  forms: {
    form: string;
    started: number;
    attempts: number;
    invalid_attempts: number;
    client_errors: number;
    client_success: number;
    abandoned: number;
    server_received: number;
    server_rejected: number;
  }[];
  field_errors: { form: string; field: string; code: string; errors: number }[];
  rejections: { form: string; reason: string; n: number }[];
  abandon_fields: { form: string; last_field: string; n: number }[];
  cta: { cta: string; clicks: number; visitors: number }[];
  db_counts: { kontakt: number; mitgliedschaft: number };
  versions: {
    event: string;
    source: string;
    schema_version: number;
    events: number;
    first_seen: string;
    last_seen: string;
  }[];
  experiments: {
    key: string;
    version: number;
    description: string | null;
    status: string;
    goal_event: string;
    goal_filter: Record<string, string | number | boolean | null>;
    started_at: string | null;
    ended_at: string | null;
    variants: Record<string, number>;
    results: VariantResult[];
    analysis: ReturnType<typeof analyzeVariants>;
  }[];
};

/** Aktuell gültige Schema-Version je Ereignis: nur diese fließen in die Kennzahlen ein. */
export const CURRENT_VERSIONS: Record<string, number> = {
  ...Object.fromEntries(Object.entries(EVENT_SCHEMAS).map(([k, v]) => [k, v.version])),
  ...Object.fromEntries(Object.entries(SERVER_EVENT_SCHEMAS).map(([k, v]) => [k, v.version])),
};

/** Statistik für /admin/statistik. Nur für Admin und Vorstand. */
export const getAnalyticsDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ days: z.number().int().min(1).max(90) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<DashboardData> => {
    const { data: roleRows, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Response("Forbidden", { status: 403 });
    const roles = (roleRows || []).map((r: any) => r.role as string);
    if (!roles.includes("admin") && !roles.includes("board")) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Test-Definitionen aus dem Code in die Datenbank übernehmen (neue Versionen, beendete Tests)
    const { syncExperiments } = await import("@/lib/analytics/server");
    await syncExperiments(true);
    const to = new Date();
    const from = new Date(to.getTime() - data.days * 24 * 60 * 60 * 1000);
    const { data: raw, error } = await supabaseAdmin.rpc("analytics_dashboard", {
      p_from: from.toISOString(),
      p_to: to.toISOString(),
      p_versions: CURRENT_VERSIONS,
    });
    if (error) throw new Error(error.message);

    const result = raw as Omit<DashboardData, "experiments"> & {
      experiments: Omit<DashboardData["experiments"][number], "analysis">[];
    };
    return {
      ...result,
      experiments: (result.experiments ?? []).map((e) => ({
        ...e,
        analysis: analyzeVariants(e.results ?? []),
      })),
    };
  });
