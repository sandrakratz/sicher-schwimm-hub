import type { EventName } from "./events";

/**
 * A/B-Tests als Code. Regeln:
 *  - Ein Test wird durch (key, version) bestimmt. Laufende oder beendete Versionen werden nie verändert.
 *    Jede inhaltliche Änderung (Varianten, Gewichte, Ziel) bekommt eine neue `version`, die Datenbank
 *    verweigert Änderungen an bestehenden Versionen. Ergebnisse alter Versionen fließen nie in neue ein.
 *  - Status: `draft` (nichts passiert), `running` (wird ausgespielt), `stopped` (alle sehen wieder `control`).
 *  - Zugewiesen wird nur mit Einwilligung zur Messung. Ohne Einwilligung sehen Besucher immer `control`.
 *  - Erfolg = ein Zielereignis (`goal`) desselben Besuchers nach der ersten Sichtung der Variante.
 */
export type ExperimentDefinition = {
  key: string;
  version: number;
  description: string;
  /** Variante → Gewicht in Prozent, Summe 100 */
  variants: Record<string, number>;
  /** Variante, die ohne Zuweisung gezeigt wird (Standard-Seite) */
  control: string;
  goal: { event: EventName; filter?: Record<string, string | number | boolean> };
  status: "draft" | "running" | "stopped";
  /** Beginn der Auswertung (ISO). Ereignisse davor zählen nicht. */
  startedAt: string;
  /** Ende der Auswertung (ISO), bei `stopped` */
  endedAt?: string;
};

export const EXPERIMENTS: readonly ExperimentDefinition[] = [
  {
    key: "kurs_buchen_button",
    version: 1,
    description:
      "Kursseite (Kinderkurse): Beschriftung der Schaltfläche, die das Buchungsformular öffnet. Die Schaltfläche im Formular selbst bleibt unverändert („Verbindlich buchen“).",
    variants: { control: 50, platz_sichern: 50 },
    control: "control",
    goal: { event: "form_submit_success", filter: { form: "kursbuchung_kind" } },
    status: "running",
    startedAt: "2026-10-30T08:30:00Z",
  },
];

/** Aktuell laufende Version eines Tests, sonst undefined. */
export function getRunningExperiment(key: string): ExperimentDefinition | undefined {
  return EXPERIMENTS.filter((e) => e.key === key && e.status === "running").sort(
    (a, b) => b.version - a.version,
  )[0];
}

export function isKnownExperimentRef(ref: { key: string; version: number; variant: string }) {
  const def = EXPERIMENTS.find((e) => e.key === ref.key && e.version === ref.version);
  return Boolean(def && def.status !== "draft" && ref.variant in def.variants);
}

/** FNV-1a, 32 Bit. Reicht für gleichmäßige Verteilung, kein Sicherheitszweck. */
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Weist einen Besucher deterministisch einer Variante zu. Gleiche Besucher-ID + Test + Version = gleiche
 * Variante. Eine neue Version würfelt neu, damit Ergebnisse unabhängig bleiben.
 */
export function pickVariant(def: ExperimentDefinition, visitorId: string): string {
  const bucket = fnv1a(`${visitorId}:${def.key}:${def.version}`) % 100;
  let acc = 0;
  for (const [variant, weight] of Object.entries(def.variants)) {
    acc += weight;
    if (bucket < acc) return variant;
  }
  return def.control;
}

/** Prüft die Definitionen. Leere Liste = alles in Ordnung. */
export function validateExperiments(defs: readonly ExperimentDefinition[] = EXPERIMENTS): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const d of defs) {
    const id = `${d.key} v${d.version}`;
    if (!/^[a-z0-9_]{2,60}$/.test(d.key)) errors.push(`${id}: Schlüssel ungültig`);
    if (!Number.isInteger(d.version) || d.version < 1) errors.push(`${id}: Version ungültig`);
    if (seen.has(id)) errors.push(`${id}: doppelt`);
    seen.add(id);
    const weights = Object.values(d.variants);
    if (weights.length < 2) errors.push(`${id}: mindestens zwei Varianten`);
    if (weights.some((w) => !Number.isInteger(w) || w <= 0))
      errors.push(`${id}: Gewichte ungültig`);
    if (weights.reduce((s, w) => s + w, 0) !== 100)
      errors.push(`${id}: Gewichte ergeben nicht 100`);
    if (!(d.control in d.variants)) errors.push(`${id}: control fehlt in den Varianten`);
    if (d.status === "stopped" && !d.endedAt) errors.push(`${id}: stopped braucht endedAt`);
  }
  return errors;
}
