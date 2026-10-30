import { createFileRoute } from "@tanstack/react-router";
import { batchSchema, EVENT_SCHEMAS, isTrackablePath, type EventName } from "@/lib/analytics/events";
import { CONSENT_VERSION } from "@/lib/analytics/consent";
import { isKnownExperimentRef } from "@/lib/analytics/experiments";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const BOT_PATTERN = /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python|node-fetch/i;

// Öffentlicher Endpunkt für Messereignisse. Er speichert keine IP-Adresse und keinen User-Agent.
// Unbekannte oder ungültige Ereignisse werden verworfen, nicht gemeldet, damit nichts durchsickert.
export const Route = createFileRoute("/api/public/analytics")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ua = request.headers.get("user-agent") ?? "";
        if (BOT_PATTERN.test(ua)) return new Response(null, { status: 204 });
        // Do Not Track / Global Privacy Control auch serverseitig respektieren
        if (request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1") {
          return new Response(null, { status: 204 });
        }

        const text = await request.text();
        if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          return new Response(null, { status: 400 });
        }
        const parsed = batchSchema.safeParse(json);
        if (!parsed.success) return new Response(null, { status: 400 });
        const batch = parsed.data;
        // Einwilligung in veralteter Fassung zählt nicht
        if (batch.consent_version !== CONSENT_VERSION) return new Response(null, { status: 204 });

        const now = Date.now();
        const rows = [];
        for (const e of batch.events) {
          const schema = EVENT_SCHEMAS[e.name as EventName];
          if (!schema || schema.version !== e.v) continue;
          if (!isTrackablePath(e.path) || !e.path.startsWith("/")) continue;
          const props = schema.props.safeParse(e.props);
          if (!props.success) continue;
          // Testbezug nur für bekannte, gestartete Tests und Varianten; eine Sichtung braucht einen Test
          if (e.exp && !isKnownExperimentRef(e.exp)) continue;
          if (e.name === "experiment_exposure" && !e.exp) continue;
          const ts = Math.min(Math.max(e.ts, now - MAX_AGE_MS), now);
          rows.push({
            source: "client" as const,
            event: e.name,
            schema_version: e.v,
            occurred_at: new Date(ts).toISOString(),
            app_build: batch.app_build ?? null,
            consent_version: batch.consent_version,
            visitor_id: batch.visitor_id,
            session_id: batch.session_id,
            path: e.path,
            referrer_host: batch.referrer_host ?? null,
            device_class: batch.device_class ?? null,
            experiment_key: e.exp?.key ?? null,
            experiment_version: e.exp?.version ?? null,
            variant: e.exp?.variant ?? null,
            props: props.data,
          });
        }
        if (rows.length === 0) return new Response(null, { status: 204 });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          if (rows.some((r) => r.event === "experiment_exposure")) {
            const { syncExperiments } = await import("@/lib/analytics/server");
            await syncExperiments();
          }
          const { error } = await supabaseAdmin.from("analytics_events").insert(rows);
          if (error) console.error("[analytics] insert failed", error);
        } catch (e) {
          console.error("[analytics] insert failed", e);
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});
