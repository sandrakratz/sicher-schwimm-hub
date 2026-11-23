// Server-only: Anzeigename der angemeldeten Person für „Abgenommen von“ im Prüfungsnachweis.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fullName } from "@/lib/format";

export async function displayNameOf(userId: string): Promise<string> {
  const { data: me } = await supabaseAdmin
    .from("profiles")
    .select("first_name,last_name,email")
    .eq("id", userId)
    .maybeSingle();
  return fullName(me?.first_name, me?.last_name) || me?.email || "Unbekannt";
}
