import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = ["admin", "board", "trainer", "member", "parent"] as const;
type Role = (typeof ROLES)[number];

async function fetchRoles(supabase: any, userId: string): Promise<Role[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Response("Forbidden", { status: 403 });
  return (data || []).map((r: any) => r.role as Role);
}

/**
 * Server-side check that the calling user has admin or board role.
 */
export const assertIsStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const roles = await fetchRoles(context.supabase, context.userId);
    const ok = roles.includes("admin") || roles.includes("board");
    if (!ok) throw new Response("Forbidden", { status: 403 });
    return { ok: true };
  });

/**
 * Generic guard: throws 403 unless the user has at least one of the given roles.
 */
export const assertHasAnyRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ roles: z.array(z.enum(ROLES)).min(1) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const roles = await fetchRoles(context.supabase, context.userId);
    const ok = roles.some((r) => data.roles.includes(r));
    if (!ok) throw new Response("Forbidden", { status: 403 });
    return { ok: true };
  });

/**
 * Returns the calling user's roles. Used by the admin layout to filter the
 * sidebar and to decide between full / read-only UI in member-facing pages.
 */
export const getMyAdminRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const roles = await fetchRoles(context.supabase, context.userId);
    const allowed: Role[] = ["admin", "board", "trainer"];
    if (!roles.some((r) => allowed.includes(r))) {
      throw new Response("Forbidden", { status: 403 });
    }
    return { roles };
  });
