const TZ = "Europe/Berlin";

export function formatDateBerlin(input: string | Date | null | undefined): string {
  if (!input) return "—";
  try {
    const d = typeof input === "string" ? new Date(input) : input;
    if (isNaN(d.getTime())) return typeof input === "string" ? input : "—";
    return d.toLocaleDateString("de-DE", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return typeof input === "string" ? input : "—";
  }
}

export function formatDateTimeBerlin(input: string | Date | null | undefined): string {
  if (!input) return "—";
  try {
    const d = typeof input === "string" ? new Date(input) : input;
    if (isNaN(d.getTime())) return typeof input === "string" ? input : "—";
    return d.toLocaleString("de-DE", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return typeof input === "string" ? input : "—";
  }
}

/** Einheitliche Preisdarstellung (EUR, ohne Nachkommastellen). */
export function formatPrice(value: number | null | undefined): string | null {
  if (value == null) return null;
  const n = Number(value);
  if (isNaN(n)) return null;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
