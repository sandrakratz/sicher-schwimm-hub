// Server-only: Anzeigename der angemeldeten Person für „Abgenommen von“ im Prüfungsnachweis.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function displayNameOf(userId: string): Promise<string> {
  const { data: me } = await supabaseAdmin
    .from("profiles")
    .select("first_name,last_name,email")
    .eq("id", userId)
    .maybeSingle();
  return (
    [me?.first_name, me?.last_name].filter(Boolean).join(" ").trim() || me?.email || "Unbekannt"
  );
}
