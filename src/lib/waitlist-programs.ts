// Mischkurse: Ein Kursangebot kann Kinder aus mehreren Wartelisten aufnehmen.
// Schlüssel = Slug des Mischkurs-Angebots, Werte = Slugs der zugehörigen Wartelisten.
export const MIXED_PROGRAMS: Record<string, Array<string>> = {
  'schwimmabzeichen-aufbaukurs': ['bronze', 'silber', 'gold'],
}

/** Liefert alle Programm-IDs, deren Warteliste für einen Kurs dieses Programms passt. */
export function relatedProgramIds(
  programId: string | null,
  programs: Array<{ id: string; slug: string }>,
): Array<string> {
  if (!programId) return []
  const p = programs.find((x) => x.id === programId)
  const extra = p ? MIXED_PROGRAMS[p.slug] ?? [] : []
  const ids = programs.filter((x) => extra.includes(x.slug)).map((x) => x.id)
  return [programId, ...ids]
}
