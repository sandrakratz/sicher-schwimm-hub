/** Anzeigetext für den Gurt-Stand: 6 = Anfänger … 0 = schwimmt ohne Gurt, null = nicht erfasst. */
export function beltLabel(blocks: number | null | undefined): string {
  if (blocks == null) return "nicht erfasst";
  if (blocks === 0) return "ohne Gurt";
  return blocks === 1 ? "1 Klötzchen" : `${blocks} Klötzchen`;
}
