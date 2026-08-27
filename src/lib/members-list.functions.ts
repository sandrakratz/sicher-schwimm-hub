import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ActiveMember = {
  id: string;
  name: string;
  membership_type: string;
  member_since: string | null;
};

/**
 * Read-only list of active club members for admin, board and trainers.
 * Deliberately returns no contact/banking data.
 */
export const listActiveMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActiveMember[]> => {
    const { data: roleRows, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleErr) throw new Response("Forbidden", { status: 403 });
    const roles = (roleRows || []).map((r: any) => r.role as string);
    if (!roles.some((r) => ["admin", "board", "trainer"].includes(r))) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("memberships")
      .select("id, first_name, last_name, membership_type, approved_at, created_at")
      .eq("status", "active")
      .order("last_name", { ascending: true });
    if (error) throw new Error(error.message);

    return (data || []).map((m: any) => ({
      id: m.id as string,
      name: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim(),
      membership_type: m.membership_type as string,
      member_since: (m.approved_at ?? m.created_at) as string | null,
    }));
  });
