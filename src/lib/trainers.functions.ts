import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TrainerOption = { id: string; name: string; email: string };

/**
 * Liste aller Personen, die Kurstermine übernehmen können (Trainer, Admin, Vorstand).
 * Lesbar für Team-Rollen; nutzt den Admin-Client, da Trainer die Profile anderer
 * Team-Mitglieder per RLS nicht lesen dürfen.
 */
export const listTrainers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrainerOption[]> => {
    const { supabase, userId } = context;
    const [admin, board, trainer] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "board" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "trainer" }),
    ]);
    if (!admin.data && !board.data && !trainer.data) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRows, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id,role")
      .in("role", ["admin", "board", "trainer"]);
    if (rErr) throw rErr;

    const ids = Array.from(new Set((roleRows || []).map((r: any) => r.user_id)));
    if (ids.length === 0) return [];

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id,first_name,last_name,email")
      .in("id", ids);
    if (pErr) throw pErr;

    return (profiles || [])
      .map((p: any) => ({
        id: p.id as string,
        name: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || (p.email as string),
        email: p.email as string,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  });
