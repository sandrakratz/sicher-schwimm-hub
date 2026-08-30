// Gemeinsame Datenaufbereitung für die Kursbestätigung (E-Mail und PDF).
import { BILLING, ORG } from "@/lib/billing-config";
import { formatDateBerlin } from "@/lib/format";
import { buildEpcPayload, buildPayQrUrl } from "@/lib/epc-qr";

export interface ConfirmationInput {
  documentNo?: string | null;
  issuedAt?: string | null;
  payerName?: string | null;
  payerStreet?: string | null;
  payerZip?: string | null;
  payerCity?: string | null;
  childName?: string | null;
  courseName?: string | null;
  programName?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  schedule?: string | null;
  location?: string | null;
  unitCount?: number | null;
  priceAmount?: number | null;
  paymentDueDays?: number | null;
}

export interface ConfirmationDoc {
  org: typeof ORG;
  bank: typeof BILLING;
  documentNo: string;
  issuedAtLabel: string;
  payerName: string;
  payerLines: Array<string>;
  childName: string;
  courseTitle: string;
  periodLabel: string;
  scheduleLabel: string;
  locationLabel: string;
  unitLabel: string;
  priceLabel: string;
  dueDateLabel: string;
  /** true, wenn der Kurs innerhalb der letzten 10 Tage vor Kursbeginn gebucht wurde. */
  immediatePayment: boolean;
  /** Fertiger Zahlungssatz für E-Mail und PDF. */
  paymentInstruction: string;
  /** Kurzbezeichnung der Zahlungsart. */
  paymentMethodLabel: string;
  /** Beschreibung des Zahlungsziels. */
  paymentTermsLabel: string;
  paymentReference: string;
  /** EPC-QR-Datensatz (GiroCode) – nur bei Sofortzahlung gesetzt. */
  epcPayload: string | null;
  /** Absolute URL zum QR-Code-Bild – nur bei Sofortzahlung gesetzt. */
  payQrUrl: string | null;
}

export function formatEuro(v?: number | null): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(v));
}

function addDays(iso: string, days: number): Date {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d;
}

/** Spätester Zahlungstermin: 10 Tage vor Kursbeginn. */
export const DAYS_BEFORE_START = 10;

export function computeDueDate(
  issuedAt: string,
  paymentDueDays: number,
  startsOn?: string | null,
): Date {
  const due = addDays(issuedAt, paymentDueDays);
  if (startsOn) {
    const beforeStart = addDays(`${startsOn}T12:00:00`, -DAYS_BEFORE_START);
    if (beforeStart.getTime() < due.getTime()) return beforeStart;
  }
  return due;
}

/** Zahlung ist sofort fällig, wenn der späteste Termin nicht mehr in der Zukunft liegt. */
export function isImmediatePayment(
  issuedAt: string,
  paymentDueDays: number,
  startsOn?: string | null,
): boolean {
  const due = computeDueDate(issuedAt, paymentDueDays, startsOn);
  return due.getTime() <= new Date(issuedAt).getTime();
}

export function buildConfirmationDoc(input: ConfirmationInput): ConfirmationDoc {
  const issuedAt = input.issuedAt || new Date().toISOString();
  const documentNo = input.documentNo || "—";
  const childName = input.childName || "—";
  const courseTitle = input.programName || input.courseName || "Schwimmkurs";
  const dueDays = input.paymentDueDays ?? 14;

  const payerLines = [
    input.payerStreet || "",
    [input.payerZip, input.payerCity].filter(Boolean).join(" "),
  ].filter((l) => l.trim().length > 0);

  const immediate = isImmediatePayment(issuedAt, dueDays, input.startsOn);
  const dueDateLabel = formatDateBerlin(computeDueDate(issuedAt, dueDays, input.startsOn));

  const reference = `${documentNo} / ${childName}`;

  const period =
    input.startsOn || input.endsOn
      ? `${formatDateBerlin(input.startsOn)} bis ${formatDateBerlin(input.endsOn)}`
      : "—";

  return {
    org: ORG,
    bank: BILLING,
    documentNo,
    issuedAtLabel: formatDateBerlin(issuedAt),
    payerName: input.payerName || "—",
    payerLines,
    childName,
    courseTitle:
      input.courseName && input.programName && input.courseName !== input.programName
        ? `${input.programName} (${input.courseName})`
        : courseTitle,
    periodLabel: period,
    scheduleLabel: input.schedule || "—",
    locationLabel: input.location || "—",
    unitLabel: input.unitCount != null ? String(input.unitCount) : "—",
    priceLabel: formatEuro(input.priceAmount),
    dueDateLabel,
    immediatePayment: immediate,
    paymentInstruction: immediate
      ? `Da die Buchung innerhalb der letzten ${DAYS_BEFORE_START} Tage vor Kursbeginn erfolgt ist, ist die Kursgebühr sofort per Echtzeit-/Sofortüberweisung unter Angabe der Dokument-Nr. ${documentNo} auf folgendes Vereinskonto zu zahlen:`
      : `Bitte überweisen Sie die Kursgebühr bis zum ${dueDateLabel} unter Angabe der Dokument-Nr. ${documentNo} auf folgendes Vereinskonto:`,
    paymentMethodLabel: immediate ? "Echtzeit-/Sofortüberweisung" : "Überweisung",
    paymentTermsLabel: immediate
      ? `Buchung innerhalb der letzten ${DAYS_BEFORE_START} Tage vor Kursbeginn – sofort fällig`
      : `${dueDays} Tage nach Bestätigung, spätestens ${DAYS_BEFORE_START} Tage vor Kursbeginn`,
    paymentReference: reference,
    epcPayload: immediate ? buildEpcPayload({ amount: input.priceAmount, reference }) : null,
    payQrUrl: immediate ? buildPayQrUrl({ amount: input.priceAmount, reference }) : null,
  };
}
