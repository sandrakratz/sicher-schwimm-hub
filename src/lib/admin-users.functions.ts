import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUSES = ["pending", "active", "disabled", "archived"] as const;
const ROLES = ["admin", "board", "trainer", "member", "parent"] as const;

async function assertAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Response("Forbidden", { status: 403 });
}

async function assertStaff(supabase: any, userId: string) {
  const { data: isStaff } = await supabase.rpc("is_staff", { _user_id: userId });
  if (!isStaff) throw new Response("Forbidden", { status: 403 });
}

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Response("Du kannst dich nicht selbst löschen.", { status: 400 });
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Response(error.message, { status: 500 });
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(context.supabase, context.userId, {
      action: "user.deleted",
      entity: "auth.users",
      entity_id: data.userId,
    });
    return { ok: true };
  });

export const setUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ userId: z.string().uuid(), status: z.enum(STATUSES) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("profiles")
      .update({ status: data.status })
      .eq("id", data.userId);
    if (error) throw new Response(error.message, { status: 500 });
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(context.supabase, context.userId, {
      action: "user.status_changed",
      entity: "profiles",
      entity_id: data.userId,
      metadata: { status: data.status },
    });
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(ROLES),
        enabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    if (data.enabled) {
      const { error } = await context.supabase
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (error && !String(error.message).toLowerCase().includes("duplicate")) {
        throw new Response(error.message, { status: 500 });
      }
    } else {
      const { error } = await context.supabase
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Response(error.message, { status: 500 });
    }
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(context.supabase, context.userId, {
      action: data.enabled ? "user.role_granted" : "user.role_revoked",
      entity: "user_roles",
      entity_id: data.userId,
      metadata: { role: data.role },
    });
    return { ok: true };
  });
