import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/auth-guards.server";

/**
 * Probelauf des Löschjobs (Löschkonzept 2027): zählt, was gelöscht würde, und rollt alles zurück.
 * Ändert keine Daten. Liefert nur Anzahlen, keine Namen.
 */
export const runRetentionDryRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ counts: Record<string, number>; stand: string }> => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Funktion fehlt in den generierten Typen (neue Migration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any).rpc("run_retention_2027", {
      dry_run: true,
    });
    if (error) throw new Error(`Probelauf fehlgeschlagen: ${error.message}`);
    const res = (data ?? {}) as Record<string, unknown>;
    const counts: Record<string, number> = {};
    for (const [k, v] of Object.entries(res)) if (typeof v === "number") counts[k] = v;
    return { counts, stand: String(res["stand"] ?? "") };
  });
