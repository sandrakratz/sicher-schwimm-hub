/**
 * Wichtiger Hinweis zum Kind für Trainer und Vorstand: der gepflegte Hinweis des Kindes (`notes`)
 * plus die Gesundheitsangaben aus der Anmeldung (`course_requests.health_info`).
 * Gesundheitsangaben gehen so auch dann nicht verloren, wenn sie bei der Buchung nur an der Anfrage
 * gelandet sind. Steht der Text der Anmeldung schon im Hinweis, wird er nicht doppelt gezeigt.
 */
export function combineChildHint(
  notes: string | null | undefined,
  healthInfo: string | null | undefined,
): string | null {
  const n = (notes ?? "").trim();
  const h = (healthInfo ?? "").trim();
  if (!h) return n || null;
  if (!n) return `Gesundheit: ${h}`;
  if (n.includes(h)) return n;
  return `Gesundheit: ${h}\n${n}`;
}
