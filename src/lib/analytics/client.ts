import {
  CONSENT_VERSION,
  getSessionId,
  getVisitorId,
  hasAnalyticsConsent,
  subscribeConsent,
} from "./consent";
import { EVENT_SCHEMAS, isTrackablePath, type EventName } from "./events";
import type { z } from "zod";

type PropsOf<N extends EventName> = z.infer<(typeof EVENT_SCHEMAS)[N]["props"]>;

export type ExperimentRef = { key: string; version: number; variant: string };

type QueuedEvent = {
  name: string;
  v: number;
  ts: number;
  path: string;
  props: Record<string, unknown>;
  exp?: ExperimentRef;
};

const ENDPOINT = "/api/public/analytics";
const FLUSH_INTERVAL_MS = 5000;
const MAX_BATCH = 25;
const APP_BUILD = (import.meta.env.VITE_APP_BUILD as string | undefined) ?? "dev";

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setInterval> | undefined;
let started = false;

function currentPath(): string {
  return window.location.pathname.replace(/\/+$/, "") || "/";
}

function deviceClass(): "mobile" | "tablet" | "desktop" {
  const w = window.innerWidth;
  return w < 768 ? "mobile" : w < 1100 ? "tablet" : "desktop";
}

function referrerHost(): string | undefined {
  try {
    if (!document.referrer) return undefined;
    const host = new URL(document.referrer).hostname;
    return host === window.location.hostname ? undefined : host.slice(0, 120);
  } catch {
    return undefined;
  }
}

/** Sendet die Warteschlange. Beim Verlassen der Seite per sendBeacon, sonst per fetch. */
export function flush(useBeacon = false) {
  if (queue.length === 0) return;
  if (!hasAnalyticsConsent()) {
    queue = [];
    return;
  }
  const events = queue.splice(0, MAX_BATCH);
  const body = JSON.stringify({
    consent_version: CONSENT_VERSION,
    visitor_id: getVisitorId(),
    session_id: getSessionId(),
    app_build: APP_BUILD,
    device_class: deviceClass(),
    referrer_host: referrerHost(),
    events,
  });
  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
    } else {
      void fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
    /* Messung darf die Seite nie stören */
  }
  if (queue.length > 0) flush(useBeacon);
}

/** Startet Timer und Seiten-Verlassen-Handler. Mehrfaches Aufrufen ist harmlos. */
export function startAnalytics() {
  if (started || typeof window === "undefined") return;
  started = true;
  timer = setInterval(() => flush(), FLUSH_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
  window.addEventListener("pagehide", () => flush(true));
  subscribeConsent(() => {
    if (!hasAnalyticsConsent()) queue = [];
  });
}

export function stopAnalytics() {
  if (timer) clearInterval(timer);
  timer = undefined;
  started = false;
  queue = [];
}

/**
 * Erfasst ein Ereignis, aber nur mit Einwilligung und nur in Bereichen, die gemessen werden dürfen.
 * Falsche Felder werden bereits hier verworfen (gleiche Definition wie auf dem Server).
 */
export function track<N extends EventName>(
  name: N,
  props: PropsOf<N>,
  exp?: ExperimentRef,
  /** Seite, zu der das Ereignis gehört. Nötig, wenn es erst nach dem Seitenwechsel gemeldet wird. */
  pathOverride?: string,
) {
  if (typeof window === "undefined" || !hasAnalyticsConsent()) return;
  const path = pathOverride ?? currentPath();
  if (!isTrackablePath(path)) return;
  const schema = EVENT_SCHEMAS[name];
  const parsed = schema.props.safeParse(props);
  if (!parsed.success) {
    if (import.meta.env.DEV)
      console.warn(`[analytics] ungültige Eigenschaften für ${name}`, parsed.error);
    return;
  }
  startAnalytics();
  queue.push({
    name,
    v: schema.version,
    ts: Date.now(),
    path,
    props: parsed.data as Record<string, unknown>,
    exp,
  });
  if (queue.length >= MAX_BATCH) flush();
}
