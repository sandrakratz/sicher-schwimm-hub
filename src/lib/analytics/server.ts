import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SERVER_EVENT_SCHEMAS, type ServerEventName } from "./events";
import type { z } from "zod";

type PropsOf<N extends ServerEventName> = z.infer<(typeof SERVER_EVENT_SCHEMAS)[N]["props"]>;

/**
 * Serverseitige Gegenmessung: zählt eingegangene und abgewiesene Formulare, ohne Besucher-ID,
 * ohne IP und ohne Zugriff auf das Gerät. Darf nie die eigentliche Anfrage stören.
 */
export async function recordServerEvent<N extends ServerEventName>(
  name: N,
  props: PropsOf<N>,
  path?: string,
) {
  try {
    const schema = SERVER_EVENT_SCHEMAS[name];
    const parsed = schema.props.safeParse(props);
    if (!parsed.success) return;
    // Tabelle ist noch nicht in den generierten Typen (types.ts), bis die Migration eingespielt und neu generiert ist
    await (supabaseAdmin as any).from("analytics_events").insert({
      source: "server",
      event: name,
      schema_version: schema.version,
      app_build: process.env.APP_BUILD ?? null,
      path: path?.slice(0, 200) ?? null,
      props: parsed.data,
    });
  } catch (e) {
    console.error("[analytics] server event failed", e);
  }
}

/**
 * Zählt den Ausgang einer Formular-Verarbeitung auf dem Server, ohne ihr Ergebnis zu verändern.
 * Gegenstück zu `form_submit_attempt` / `form_submit_success` aus dem Browser:
 * Zahl der Versuche mit gültigen Angaben ≈ eingegangen + abgewiesen (Rest: Adblocker, Netzfehler, fehlende Einwilligung).
 */
export async function countSubmission<T>(
  form: string,
  honeypot: boolean,
  run: () => Promise<T>,
): Promise<T> {
  if (honeypot) {
    await recordServerEvent("form_rejected", { form, reason: "honeypot" });
    return run();
  }
  let result: T;
  try {
    result = await run();
  } catch (e) {
    await recordServerEvent("form_rejected", { form, reason: "fehler" });
    throw e;
  }
  const r = result as { ok?: boolean; blocked?: boolean; duplicate?: boolean } | undefined;
  if (r?.blocked) await recordServerEvent("form_rejected", { form, reason: "gesperrt" });
  else if (r?.duplicate) await recordServerEvent("form_rejected", { form, reason: "doppelt" });
  else if (r?.ok === false) await recordServerEvent("form_rejected", { form, reason: "abgelehnt" });
  else await recordServerEvent("form_received", { form });
  return result;
}

let lastExperimentSync = 0;

/**
 * Gleicht die Test-Definitionen aus dem Code mit der Tabelle analytics_experiments ab.
 * Neue Versionen werden angelegt, beendete auf `stopped` gesetzt. Wurde eine bestehende Version im Code
 * verändert, bleibt die Datenbank unverändert und es gibt eine Fehlermeldung im Log:
 * Änderungen gehören in eine neue Version.
 */
export async function syncExperiments(force = false) {
  const now = Date.now();
  if (!force && now - lastExperimentSync < 5 * 60 * 1000) return;
  lastExperimentSync = now;
  try {
    const { EXPERIMENTS } = await import("./experiments");
    const db = supabaseAdmin as any;
    const { data: rows, error } = await db
      .from("analytics_experiments")
      .select("key,version,variants,goal_event,goal_filter,status");
    if (error) throw error;
    for (const def of EXPERIMENTS) {
      if (def.status === "draft") continue;
      const existing = (rows ?? []).find(
        (r: any) => r.key === def.key && r.version === def.version,
      );
      const goalFilter = def.goal.filter ?? {};
      if (!existing) {
        await db.from("analytics_experiments").insert({
          key: def.key,
          version: def.version,
          description: def.description,
          variants: def.variants,
          goal_event: def.goal.event,
          goal_filter: goalFilter,
          status: def.status,
          started_at: def.startedAt,
          ended_at: def.endedAt ?? null,
        });
        continue;
      }
      const changed =
        JSON.stringify(sortKeys(existing.variants)) !== JSON.stringify(sortKeys(def.variants)) ||
        existing.goal_event !== def.goal.event ||
        JSON.stringify(sortKeys(existing.goal_filter ?? {})) !==
          JSON.stringify(sortKeys(goalFilter));
      if (changed) {
        console.error(
          `[analytics] Test ${def.key} v${def.version} wurde im Code verändert. Bitte eine neue Version anlegen.`,
        );
        continue;
      }
      if (def.status === "stopped" && existing.status !== "stopped") {
        await db
          .from("analytics_experiments")
          .update({ status: "stopped", ended_at: def.endedAt ?? new Date().toISOString() })
          .eq("key", def.key)
          .eq("version", def.version);
      }
    }
  } catch (e) {
    console.error("[analytics] experiment sync failed", e);
  }
}

function sortKeys(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}
