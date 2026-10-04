/** Leerzeichen entfernen, Großbuchstaben. */
export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** Prüft Aufbau, Länge für deutsche IBAN (22) bzw. allgemein 15–34 Zeichen und die Prüfziffer (Modulo 97). */
export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("DE") && iban.length !== 22) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const digits = ch >= "A" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}

/** In Vierergruppen: „DE89 3704 0044 0532 0130 00“. */
export function formatIban(raw: string): string {
  return normalizeIban(raw)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

/** Für Hinweis-Mails: nur Länderkennung und letzte vier Stellen („DE•• •••• 3000“). */
export function maskIban(raw: string): string {
  const iban = normalizeIban(raw);
  if (iban.length < 8) return "••••";
  return `${iban.slice(0, 2)}•• •••• ${iban.slice(-4)}`;
}
