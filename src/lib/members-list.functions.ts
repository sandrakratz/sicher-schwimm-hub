import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FamilyPerson = { name: string; date_of_birth: string | null };

export type ActiveMember = {
  id: string;
  name: string;
  membership_type: string;
  member_since: string | null;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
  partner: FamilyPerson | null;
  children: FamilyPerson[];
};

function toPerson(v: unknown): FamilyPerson | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const name = typeof o["name"] === "string" ? o["name"].trim() : "";
  if (!name) return null;
  const dob = typeof o["date_of_birth"] === "string" ? o["date_of_birth"] : null;
  return { name, date_of_birth: dob };
}

/**
 * Read-only list of active club members for admin, board and trainers.
 * Includes contact data and family members, but never SEPA/banking data.
 */
export const listActiveMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActiveMember[]> => {
    const { data: roleRows, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleErr) throw new Response("Forbidden", { status: 403 });
    const roles = (roleRows || []).map((r: { role: string }) => r.role);
    if (!roles.some((r) => ["admin", "board", "trainer"].includes(r))) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("memberships")
      // Bewusst ohne sepa_* Spalten – Bankdaten verlassen den Server nicht.
      .select("id, first_name, last_name, membership_type, approved_at, created_at, date_of_birth, email, phone, family_members")
      .eq("status", "active")
      .order("last_name", { ascending: true });
    if (error) throw new Error(error.message);

    return (data || []).map((m) => {
      const fm = (m.family_members ?? null) as Record<string, unknown> | null;
      const childrenRaw = Array.isArray(fm?.["children"]) ? (fm["children"] as unknown[]) : [];
      return {
        id: m.id as string,
        name: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim(),
        membership_type: m.membership_type as string,
        member_since: (m.approved_at ?? m.created_at) as string | null,
        date_of_birth: (m.date_of_birth ?? null) as string | null,
        email: (m.email ?? null) as string | null,
        phone: (m.phone ?? null) as string | null,
        partner: toPerson(fm?.["partner"]),
        children: childrenRaw.map(toPerson).filter((p): p is FamilyPerson => p !== null),
      };
    });
  });
