import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUSES = ["eingegangen", "in_bearbeitung", "abgeschlossen"] as const;

async function assertStaff(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Forbidden");
  const roles = (data || []).map((r: any) => r.role);
  if (!roles.includes("admin") && !roles.includes("board")) {
    throw new Error("Forbidden");
  }
}

export const listCancellations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      status: z.enum(STATUSES).optional(),
      search: z.string().trim().max(200).optional(),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    let q = context.supabase
      .from("cancellation_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status) q = q.eq("status", data.status);
    if (data.from) q = q.gte("created_at", `${data.from}T00:00:00Z`);
    if (data.to) q = q.lte("created_at", `${data.to}T23:59:59Z`);
    if (data.search) {
      const s = data.search.replace(/[,()]/g, "");
      q = q.or(
        `reference_number.ilike.%${s}%,email.ilike.%${s}%,child_name.ilike.%${s}%,parent_last_name.ilike.%${s}%,parent_first_name.ilike.%${s}%`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const setCancellationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(STATUSES),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin
      .from("cancellation_requests").select("status, reference_number").eq("id", data.id).maybeSingle();
    const { error } = await supabaseAdmin
      .from("cancellation_requests").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    try {
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit(null, context.userId, {
        action: "cancellation.status_changed",
        entity: "cancellation_request",
        entity_id: data.id,
        metadata: {
          from: before?.status ?? null,
          to: data.status,
          reference_number: before?.reference_number ?? null,
        },
      });
    } catch (e) {
      console.error("[audit] cancellation.status_changed", e);
    }
    return { ok: true };
  });
