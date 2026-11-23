/**
 * Einheitliche Darstellung von Datum, Uhrzeit, Beträgen und Namen.
 * Alle Datumsangaben werden in Berliner Zeit ausgegeben, egal wo Server oder Browser laufen.
 */
const TZ = "Europe/Berlin";

/** Heutiges Datum in Berlin (YYYY-MM-DD) – nicht UTC, sonst stimmt „heute“ nachts zwischen 0 und 2 Uhr nicht. */
export function todayBerlinIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Kalendertag (YYYY-MM-DD) um `days` Tage verschieben, ohne Zeitzonen-Effekte. */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Reiner Kalendertag (YYYY-MM-DD) als Mittag UTC – so fällt er in jeder Zeitzone auf denselben Tag.
 * Gibt null zurück, wenn der Text kein gültiges Datum ist.
 */
function dayOf(iso: string): Date | null {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return isNaN(d.getTime()) ? null : d;
}

/** Datum, z. B. „05.01.2026“. Leer → „—“. */
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

/** Datum mit Uhrzeit, z. B. „05.01.2026, 14:30“. Leer → „—“. */
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

/** Kalendertag kurz mit Wochentag, z. B. „Mo., 05.01.“ (für Spalten und Listen). */
export function formatWeekdayShort(iso: string): string {
  const d = dayOf(iso);
  if (!d) return iso;
  return d.toLocaleDateString("de-DE", {
    timeZone: TZ,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

/** Kalendertag mit ausgeschriebenem Wochentag, z. B. „Montag, 05.01.2026“. */
export function formatWeekdayLong(iso: string): string {
  const d = dayOf(iso);
  if (!d) return iso;
  return d.toLocaleDateString("de-DE", {
    timeZone: TZ,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Monat und Jahr, z. B. „Januar 2026“. Nimmt „YYYY-MM“ oder „YYYY-MM-DD“. */
export function formatMonthYear(iso: string): string {
  const d = dayOf(iso.length === 7 ? `${iso}-01` : iso);
  if (!d) return iso;
  return d.toLocaleDateString("de-DE", { timeZone: TZ, month: "long", year: "numeric" });
}

/** Preis in ganzen Euro, z. B. „85 €“ (öffentliche Kurspreise). Leer → null. */
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

const EURO = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

/** Betrag mit Cent, z. B. „1.234,50 €“ (Rechnungen, Zahlungen, Abrechnung). Leer → „—“. */
export function formatEuro(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (isNaN(n)) return "—";
  return EURO.format(n);
}

/** Kursdauer: reine Zahl bekommt „Wochen“ angehängt („8“ → „8 Wochen“), sonst Text unverändert. Leer → null. */
export function formatDuration(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  if (!t) return null;
  return /^\d+(\.\d+)?$/.test(t) ? `${t} Wochen` : t;
}

/** Vor- und Nachname zusammensetzen, fehlende Teile weglassen. Beide leer → "". */
export function fullName(first?: string | null, last?: string | null): string {
  return [first, last]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" ");
}
