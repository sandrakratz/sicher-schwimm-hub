import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyMembership = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const email = context.claims?.email as string | undefined;

    // First try by user_id (RLS-respected)
    const own = await supabase
      .from("memberships")
      .select("id,status,membership_type,first_name,last_name,email")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (own.data) return own.data;

    // Fall back: admin lookup by email, then auto-link to current user
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
    return { id: row.id, status: row.status, membership_type: row.membership_type, first_name: row.first_name, last_name: row.last_name, email: row.email };
  });
