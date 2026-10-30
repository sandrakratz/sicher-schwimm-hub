import { useEffect, useState } from "react";
import { track } from "./client";
import {
  getStoredAssignment,
  getVisitorId,
  hasAnalyticsConsent,
  storeAssignment,
  subscribeConsent,
} from "./consent";
import { EXPERIMENTS, getRunningExperiment, pickVariant } from "./experiments";

const exposed = new Set<string>();

/**
 * Liefert die Variante eines laufenden A/B-Tests. Beim ersten Rendern (und für alle ohne Einwilligung)
 * ist das die Standardvariante, damit Server- und Browser-Ausgabe übereinstimmen.
 * `enabled = false`: nicht zuweisen und keine Sichtung melden (z. B. Seite gehört nicht zur Zielgruppe).
 */
export function useExperiment(key: string, enabled = true): string {
  const defaultVariant = EXPERIMENTS.find((e) => e.key === key)?.control ?? "control";
  const [variant, setVariant] = useState(defaultVariant);
  const [consentTick, setConsentTick] = useState(0);

  useEffect(() => subscribeConsent(() => setConsentTick((n) => n + 1)), []);

  useEffect(() => {
    const def = getRunningExperiment(key);
    if (!enabled || !def || !hasAnalyticsConsent()) {
      setVariant(defaultVariant);
      return;
    }
    const stored = getStoredAssignment(def.key, def.version);
    const assigned = stored && stored in def.variants ? stored : pickVariant(def, getVisitorId());
    storeAssignment(def.key, def.version, assigned);
    setVariant(assigned);

    const seenKey = `${def.key}:${def.version}`;
    if (!exposed.has(seenKey)) {
      exposed.add(seenKey);
      track("experiment_exposure", {}, { key: def.key, version: def.version, variant: assigned });
    }
  }, [key, enabled, defaultVariant, consentTick]);

  return variant;
}
