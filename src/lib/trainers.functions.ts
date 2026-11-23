import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertTeam } from "@/lib/auth-guards.server";
import { fullName } from "@/lib/format";

export type TrainerOption = { id: string; name: string; email: string };

/**
 * Liste aller Personen, die Kurstermine übernehmen können (Trainer, Admin, Vorstand).
 * Lesbar für Team-Rollen; nutzt den Admin-Client, da Trainer die Profile anderer
 * Team-Mitglieder per RLS nicht lesen dürfen.
 */
export const listTrainers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrainerOption[]> => {
    await assertTeam(context);

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
        name: fullName(p.first_name, p.last_name) || (p.email as string),
        email: p.email as string,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  });
