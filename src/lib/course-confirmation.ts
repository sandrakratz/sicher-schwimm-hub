// Gemeinsame Datenaufbereitung für die Kursbestätigung (E-Mail und PDF).
import { BILLING, ORG } from "@/lib/billing-config";
import { formatDateBerlin } from "@/lib/format";

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
  paymentReference: string;
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

export function computeDueDate(
  issuedAt: string,
  paymentDueDays: number,
  startsOn?: string | null,
): Date {
  const due = addDays(issuedAt, paymentDueDays);
  if (startsOn) {
    const beforeStart = addDays(`${startsOn}T12:00:00`, -1);
    if (beforeStart.getTime() < due.getTime()) return beforeStart;
  }
  return due;
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
    dueDateLabel: formatDateBerlin(computeDueDate(issuedAt, dueDays, input.startsOn)),
    paymentReference: `${documentNo} / ${childName}`,
  };
}
