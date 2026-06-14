import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUSES = ["pending", "active", "suspended", "terminated"] as const;

async function assertStaff(supabase: any, userId: string) {
  const { data: isStaff } = await supabase.rpc("is_staff", { _user_id: userId });
  if (!isStaff) throw new Response("Forbidden", { status: 403 });
}

export const getMyMembership = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const email = context.claims?.email as string | undefined;

    const own = await supabase
      .from("memberships")
      .select("id,status,membership_type,first_name,last_name,email")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (own.data) return own.data;

    if (!email) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("memberships")
      .select("id,status,membership_type,first_name,last_name,email,user_id")
      .ilike("email", email)
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row) return null;

    await supabaseAdmin.from("memberships").update({ user_id: userId }).eq("id", row.id);
    return {
      id: row.id,
      status: row.status,
      membership_type: row.membership_type,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
    };
  });

export const setMembershipStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(STATUSES) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const patch: Record<string, unknown> = { status: data.status };
    patch.approved_at = data.status === "active" ? new Date().toISOString() : null;
    const { error } = await context.supabase
      .from("memberships")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(context.supabase, context.userId, {
      action: `membership.${data.status}`,
      entity: "memberships",
      entity_id: data.id,
    });
    return { ok: true };
  });

export const deleteMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("memberships")
      .delete()
      .eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(context.supabase, context.userId, {
      action: "membership.deleted",
      entity: "memberships",
      entity_id: data.id,
    });
    return { ok: true };
  });
