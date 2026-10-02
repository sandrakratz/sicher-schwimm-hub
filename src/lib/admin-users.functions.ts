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

/**
 * Administratoren verwalten sich gegenseitig; der Vorstand darf Konten und Rollen von Administratoren
 * nicht ändern (sonst könnte sich der Vorstand selbst zum Administrator machen oder Admins entrechten).
 */
async function isAdminUser(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Berechtigungsprüfung fehlgeschlagen");
  return !!data;
}

async function assertMayManageTarget(supabase: any, actorId: string, targetId: string) {
  if (await isAdminUser(supabase, actorId)) return;
  if (await isAdminUser(supabase, targetId)) {
    throw new Error("Konten und Rollen von Administratoren dürfen nur Administratoren ändern.");
  }
}

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
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
    z.object({ userId: z.string().uuid(), status: z.enum(STATUSES) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    if (data.userId === context.userId && data.status !== "active") {
      throw new Error("Du kannst dein eigenes Konto nicht deaktivieren oder archivieren.");
    }
    await assertMayManageTarget(context.supabase, context.userId, data.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ status: data.status })
      .eq("id", data.userId);
    if (error) {
      console.error("[setUserStatus] update failed", {
        userId: data.userId,
        status: data.status,
        error,
      });
      throw new Error(error.message || "Status konnte nicht aktualisiert werden");
    }
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(context.supabase, context.userId, {
      action: "user.status_changed",
      entity: "profiles",
      entity_id: data.userId,
      metadata: { status: data.status },
    });
    if (data.status === "active") {
      try {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("email, first_name")
          .eq("id", data.userId)
          .maybeSingle();
        if (prof?.email) {
          const { sendAccountActivatedEmail } = await import("@/lib/account-activation.server");
          await sendAccountActivatedEmail({
            email: prof.email,
            firstName: prof.first_name,
            senderUserId: context.userId,
          });
        }
      } catch (e) {
        console.error("[setUserStatus] activation mail failed", e);
      }
    }
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
    const actorIsAdmin = await isAdminUser(context.supabase, context.userId);
    if (data.role === "admin" && !actorIsAdmin) {
      throw new Error(
        "Die Rolle „Administrator“ dürfen nur Administratoren vergeben oder entziehen.",
      );
    }
    await assertMayManageTarget(context.supabase, context.userId, data.userId);
    if (!data.enabled && data.role === "admin") {
      if (data.userId === context.userId) {
        throw new Error("Du kannst dir die Administrator-Rolle nicht selbst entziehen.");
      }
      // Mindestens ein Administrator muss bleiben
      const { count, error: cntErr } = await supabaseAdmin
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");
      if (cntErr) throw new Error("Berechtigungsprüfung fehlgeschlagen");
      if ((count ?? 0) <= 1)
        throw new Error("Der letzte Administrator kann nicht entfernt werden.");
    }
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
