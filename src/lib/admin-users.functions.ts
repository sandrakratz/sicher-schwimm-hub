import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUSES = ["pending", "active", "disabled", "archived"] as const;
const ROLES = ["admin", "board", "trainer", "member", "parent"] as const;

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) {
    console.error("[assertAdmin] has_role rpc failed", error);
    throw new Error("Berechtigungsprüfung fehlgeschlagen");
  }
  if (!data) throw new Error("Nur Administratoren erlaubt.");
}

async function assertStaff(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) {
    console.error("[assertStaff] is_staff rpc failed", error);
    throw new Error("Berechtigungsprüfung fehlgeschlagen");
  }
  if (!data) throw new Error("Nur Admin/Vorstand erlaubt.");
}

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Error("Du kannst dich nicht selbst löschen.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) {
      console.error("[deleteUser] failed", error);
      throw new Error(error.message || "Löschen fehlgeschlagen");
    }
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ status: data.status })
      .eq("id", data.userId);
    if (error) {
      console.error("[setUserStatus] update failed", { userId: data.userId, status: data.status, error });
      throw new Error(error.message || "Status konnte nicht aktualisiert werden");
    }
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.enabled) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (error && !String(error.message).toLowerCase().includes("duplicate")) {
        console.error("[setUserRole] insert failed", error);
        throw new Error(error.message || "Rolle konnte nicht zugewiesen werden");
      }
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) {
        console.error("[setUserRole] delete failed", error);
        throw new Error(error.message || "Rolle konnte nicht entfernt werden");
      }
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
