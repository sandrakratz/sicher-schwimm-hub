/**
 * Schutz vor „CSV-/Formel-Injection“: Beginnt eine Zelle mit = + - @ (oder Tab/Zeilenumbruch), führt Excel sie
 * beim Öffnen als Formel aus. Texte aus öffentlichen Formularen (Namen, Bemerkungen) könnten das ausnutzen.
 * Solche Zellen bekommen ein Hochkomma vorangestellt; reine Zahlen/Telefonnummern ohne Buchstaben bleiben unverändert.
 */
export function csvSafe(value: unknown): string {
  const s = String(value ?? '')
  if (!/^[=+\-@\t\r]/.test(s)) return s
  if (/^[+-]?\d[\d\s()/.,-]*$/.test(s)) return s
  return `'${s}`
}

/** Zelle für CSV mit Semikolon als Trenner: gegen Formeln gesichert und in Anführungszeichen. */
export function csvCell(value: unknown): string {
  return `"${csvSafe(value).replace(/"/g, '""')}"`
}
