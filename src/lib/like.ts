/**
 * Maskiert die Platzhalter von LIKE/ILIKE (`%`, `_`, `\`), damit Texte wie E-Mail-Adressen mit Unterstrich
 * exakt (ohne Groß-/Kleinschreibung) verglichen werden und nicht als Muster wirken.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}
