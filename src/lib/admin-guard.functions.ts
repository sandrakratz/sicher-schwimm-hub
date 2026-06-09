import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side check that the calling user has admin or board role.
 * Throws a 403 Response if not authorized.
 */
export const assertIsStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error) throw new Response("Forbidden", { status: 403 });
    const ok = !!data?.some((r) => r.role === "admin" || r.role === "board");
    if (!ok) throw new Response("Forbidden", { status: 403 });
    return { ok: true };
  });
