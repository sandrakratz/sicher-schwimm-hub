/**
 * Nummerierung der Teilnehmenden wie in der Excel-Kursliste:
 * bestätigte Teilnehmende nach Name (deutsch) sortiert, fortlaufend ab 1.
 */
export function buildBeltNumbers(
  participants: { id: string; name: string | null; status: string }[],
): Map<string, number> {
  const map = new Map<string, number>();
  participants
    .filter(p => p.status === "confirmed")
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"))
    .forEach((p, i) => map.set(p.id, i + 1));
  return map;
}
