/**
 * Einwilligung zur Nutzungsmessung (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO).
 * Wird die Beschreibung im Banner oder die Zwecke geändert, CONSENT_VERSION erhöhen: dann wird neu gefragt.
 * Ohne Zustimmung wird nichts im Browser gespeichert und nichts an den Messendpunkt gesendet.
 */

export const CONSENT_VERSION = 1;

const CONSENT_KEY = "ss_consent";
const VISITOR_KEY = "ss_visitor";
const SESSION_KEY = "ss_session";
const ASSIGN_PREFIX = "ss_exp_";

export type ConsentState = {
  version: number;
  analytics: boolean;
  decidedAt: string;
};

type Listener = () => void;
const listeners = new Set<Listener>();

function safeGet(storage: "local" | "session", key: string): string | null {
  try {
    return (storage === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: "local" | "session", key: string, value: string) {
  try {
    (storage === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    /* Speicher gesperrt: dann eben keine Messung */
  }
}

function safeRemove(storage: "local" | "session", key: string) {
  try {
    (storage === "local" ? window.localStorage : window.sessionStorage).removeItem(key);
  } catch {
    /* ignorieren */
  }
}

/** „Do Not Track“ und Global Privacy Control gelten als Ablehnung. */
export function browserSignalsOptOut(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  return nav.doNotTrack === "1" || nav.msDoNotTrack === "1" || nav.globalPrivacyControl === true;
}

/** Gespeicherte Entscheidung, oder null wenn noch nicht (oder zu einer älteren Version) entschieden wurde. */
export function getConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  const raw = safeGet("local", CONSENT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.version !== CONSENT_VERSION || typeof parsed.analytics !== "boolean") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  if (browserSignalsOptOut()) return false;
  return getConsent()?.analytics === true;
}

export function setConsent(analytics: boolean) {
  const state: ConsentState = {
    version: CONSENT_VERSION,
    analytics,
    decidedAt: new Date().toISOString(),
  };
  safeSet("local", CONSENT_KEY, JSON.stringify(state));
  if (!analytics) clearAnalyticsStorage();
  listeners.forEach((l) => l());
}

/** Löscht Besucher-ID, Sitzungs-ID und alle A/B-Zuweisungen. */
export function clearAnalyticsStorage() {
  safeRemove("local", VISITOR_KEY);
  safeRemove("session", SESSION_KEY);
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(ASSIGN_PREFIX)) window.localStorage.removeItem(key);
    }
  } catch {
    /* ignorieren */
  }
}

export function subscribeConsent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function uuid(): string {
  return crypto.randomUUID();
}

const VISITOR_MAX_AGE_MS = 13 * 30 * 24 * 60 * 60 * 1000;

/** Zufällige Besucher-ID, läuft nach 13 Monaten ab. Nur nach Zustimmung aufrufen. */
export function getVisitorId(): string {
  const raw = safeGet("local", VISITOR_KEY);
  if (raw) {
    try {
      const { id, at } = JSON.parse(raw) as { id: string; at: number };
      if (id && Date.now() - at < VISITOR_MAX_AGE_MS) return id;
    } catch {
      /* neu erzeugen */
    }
  }
  const id = uuid();
  safeSet("local", VISITOR_KEY, JSON.stringify({ id, at: Date.now() }));
  return id;
}

export function getSessionId(): string {
  const existing = safeGet("session", SESSION_KEY);
  if (existing) return existing;
  const id = uuid();
  safeSet("session", SESSION_KEY, id);
  return id;
}

/** Feste Zuweisung einer A/B-Variante pro Besucher, Experiment und Version. */
export function getStoredAssignment(key: string, version: number): string | null {
  return safeGet("local", `${ASSIGN_PREFIX}${key}_${version}`);
}

export function storeAssignment(key: string, version: number, variant: string) {
  safeSet("local", `${ASSIGN_PREFIX}${key}_${version}`, variant);
}
