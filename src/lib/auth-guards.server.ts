// Gemeinsame Berechtigungsprüfungen für Server-Funktionen.
// Nur innerhalb von Server-Handlern verwenden, immer mit dem Supabase-Client der angemeldeten Person
// (Kontext aus `requireSupabaseAuth`), nie mit dem Admin-Client.
//
// Verhalten: Fehlt die Rolle, wird `Error("Forbidden")` geworfen (bzw. die übergebene Meldung).
// Die Oberfläche wertet diese Meldung nicht aus; sie zeigt nur die Fehlermeldung an.
// Schlägt die Abfrage selbst fehl, wird ebenfalls abgebrochen („Berechtigungsprüfung fehlgeschlagen“),
// statt die Person stillschweigend als „ohne Rolle“ zu behandeln.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
type Client = SupabaseClient<Database>;
/** Kontext aus `requireSupabaseAuth`. */
export type AuthCtx = { supabase: Client; userId: string };

/** Standard-Fehlermeldung, wenn die Rolle fehlt. */
export const FORBIDDEN = "Forbidden";

function rpcFailed(fn: string, error: unknown): never {
  console.error(`[auth-guards] ${fn} fehlgeschlagen`, error);
  throw new Error("Berechtigungsprüfung fehlgeschlagen");
}

/** Hat die Person die Rolle? (Datenbankfunktion `has_role`) */
export async function hasRole(supabase: Client, userId: string, role: AppRole): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: role });
  if (error) rpcFailed("has_role", error);
  return !!data;
}

/** Vorstand oder Administrator (Datenbankfunktion `is_staff` = Rolle admin oder board). */
export async function isStaff(supabase: Client, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) rpcFailed("is_staff", error);
  return !!data;
}

/** Team = Vorstand/Administrator oder Trainer:in. */
export async function isTeam(supabase: Client, userId: string): Promise<boolean> {
  return (await isStaff(supabase, userId)) || (await hasRole(supabase, userId, "trainer"));
}

/** Bricht ab, wenn die Person nicht Vorstand/Administrator ist. */
export async function assertStaff(ctx: AuthCtx, message = FORBIDDEN): Promise<void> {
  if (!(await isStaff(ctx.supabase, ctx.userId))) throw new Error(message);
}

/** Bricht ab, wenn die Person weder Vorstand/Administrator noch Trainer:in ist. */
export async function assertTeam(ctx: AuthCtx, message = FORBIDDEN): Promise<void> {
  if (!(await isTeam(ctx.supabase, ctx.userId))) throw new Error(message);
}

/** Bricht ab, wenn die Person nicht die Rolle Trainer:in hat (Vorstand allein genügt nicht). */
export async function assertTrainer(ctx: AuthCtx, message = FORBIDDEN): Promise<void> {
  if (!(await hasRole(ctx.supabase, ctx.userId, "trainer"))) throw new Error(message);
}

/** Bricht ab, wenn die Person nicht die Rolle Administrator hat (Vorstand genügt nicht). */
export async function assertAdmin(ctx: AuthCtx, message = FORBIDDEN): Promise<void> {
  if (!(await hasRole(ctx.supabase, ctx.userId, "admin"))) throw new Error(message);
}
