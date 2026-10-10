// Feste Auswahl für Absagegründe, damit sich die Gründe auswerten lassen (Reiter „Absagen“).
// Gespeichert wird weiterhin ein Text: „Kategorie“ oder „Kategorie: Ergänzung“.

export const DECLINE_REASONS = [
  "Krankheit",
  "Termin passt nicht",
  "Umzug",
  "Kosten",
  "Kind möchte nicht mehr",
  "Kurs passt nicht",
  "Sonstiges",
] as const;

export const NO_REASON = "Ohne Angabe";

export function combineReason(category: string, detail: string): string | null {
  const d = detail.trim();
  if (!category) return d || null;
  return d ? `${category}: ${d}` : category;
}

/** Ordnet einen gespeicherten Grund einer Kategorie zu (auch ältere Freitexte). */
export function categorizeReason(reason: string | null | undefined): string {
  const r = (reason ?? "").trim();
  if (!r) return NO_REASON;
  const exact = DECLINE_REASONS.find((c) => r.toLowerCase().startsWith(c.toLowerCase()));
  if (exact) return exact;
  const l = r.toLowerCase();
  if (/krank|attest|verletz|arzt/.test(l)) return "Krankheit";
  if (/termin|zeit|verschieb|ferien|urlaub/.test(l)) return "Termin passt nicht";
  if (/umzug|zieht|wegzug/.test(l)) return "Umzug";
  if (/kosten|preis|teuer|geld/.test(l)) return "Kosten";
  if (/nicht mehr|keine lust|angst|will nicht/.test(l)) return "Kind möchte nicht mehr";
  if (/passt nicht|niveau|level|zu jung|zu alt/.test(l)) return "Kurs passt nicht";
  return "Sonstiges";
}
