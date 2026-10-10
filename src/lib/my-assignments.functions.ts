import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchAll } from "@/lib/fetch-all";

export type MyAssignments = {
  me: string | null;
  payments: number;
  messages: number;
  waitlist: number;
};

/**
 * Was ist mir zugewiesen? Ausdrückliche Zuweisung oder – ohne Zuweisung – die Standard-Zuständigkeit
 * des Bereichs. Zählt nur offene Vorgänge.
 */
export const getMyAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyAssignments> => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!isStaff) throw new Response("Forbidden", { status: 403 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("first_name,last_name")
      .eq("id", context.userId)
      .maybeSingle();
    const name = [me?.first_name, me?.last_name].filter(Boolean).join(" ").trim() || null;
    if (!name) return { me: null, payments: 0, messages: 0, waitlist: 0 };

    const { data: ruleRows } = await supabaseAdmin.from("assignment_rules").select("area,assignee");
    const rule = (area: string) => ruleRows?.find((r) => r.area === area)?.assignee ?? null;
    const mine = (assigned: string | null | undefined, area: string) =>
      (assigned || rule(area)) === name;

    const [payments, messages, waitlist] = await Promise.all([
      fetchAll<{ assigned_to: string | null }>((f, t) =>
        supabaseAdmin
          .from("course_participants")
          .select("id,assigned_to")
          .eq("status", "confirmed")
          .eq("paid", false)
          .order("id")
          .range(f, t),
      ),
      fetchAll<{ assigned_to: string | null }>((f, t) =>
        supabaseAdmin
          .from("messages")
          .select("id,assigned_to")
          .in("status", ["new", "read"])
          .order("id")
          .range(f, t),
      ),
      fetchAll<{ assigned_to: string | null }>((f, t) =>
        supabaseAdmin
          .from("waitlist_entries")
          .select("id,assigned_to")
          .in("status", ["waiting", "offered", "declined", "expired"])
          .order("id")
          .range(f, t),
      ),
    ]);

    return {
      me: name,
      payments: payments.filter((p) => mine(p.assigned_to, "payments")).length,
      messages: messages.filter((m) => mine(m.assigned_to, "messages")).length,
      waitlist: waitlist.filter((w) => mine(w.assigned_to, "waitlist")).length,
    };
  });
