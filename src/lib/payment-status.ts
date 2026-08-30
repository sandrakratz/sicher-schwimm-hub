// Ableitung von Zahlungsart, Fälligkeit und Zahlungsstatus aus Buchungs- und Kursdaten.
import { computeDueDate, isImmediatePayment, DAYS_BEFORE_START } from "@/lib/course-confirmation";
import { formatDateBerlin } from "@/lib/format";

export interface PaymentTermsInput {
  /** Zeitpunkt der Buchung (ISO). Default: jetzt. */
  bookedAt?: string | null;
  /** Kursbeginn (YYYY-MM-DD). */
  startsOn?: string | null;
  /** Zahlungsziel in Tagen (Programm/Kurs). Default 14. */
  paymentDueDays?: number | null;
}

export interface PaymentTerms {
  immediate: boolean;
  dueDate: Date;
  dueDateLabel: string;
  /** Kurzbezeichnung der Zahlungsart. */
  methodLabel: string;
  /** Erläuternder Satz für Eltern. */
  note: string;
}

export function paymentTerms(input: PaymentTermsInput): PaymentTerms {
  const bookedAt = input.bookedAt || new Date().toISOString();
  const dueDays = input.paymentDueDays ?? 14;
  const immediate = isImmediatePayment(bookedAt, dueDays, input.startsOn);
  const dueDate = computeDueDate(bookedAt, dueDays, input.startsOn);
  const dueDateLabel = formatDateBerlin(immediate ? bookedAt : dueDate);
  return {
    immediate,
    dueDate,
    dueDateLabel,
    methodLabel: immediate ? "Echtzeit-/Sofortüberweisung" : "Überweisung",
    note: immediate
      ? `Die Buchung erfolgt innerhalb der letzten ${DAYS_BEFORE_START} Tage vor Kursbeginn. Die Kursgebühr ist deshalb sofort per Echtzeit-/Sofortüberweisung zu zahlen.`
      : `Die Kursgebühr ist innerhalb von ${dueDays} Tagen nach der Buchungsbestätigung fällig, spätestens jedoch bis ${DAYS_BEFORE_START} Tage vor Kursbeginn – also bis zum ${dueDateLabel}.`,
  };
}

export type PaymentStateKey = "paid" | "immediate" | "overdue" | "expected";

export interface PaymentState {
  key: PaymentStateKey;
  label: string;
  /** Tailwind-Klassen für ein Badge. */
  className: string;
  detail: string;
}

export function paymentState(p: {
  paid: boolean;
  paidAt?: string | null;
  bookedAt?: string | null;
  startsOn?: string | null;
  paymentDueDays?: number | null;
  /** Serverseitig gespeicherte Zahlungsart ('transfer' | 'immediate'). */
  method?: string | null;
  /** Serverseitig gespeichertes Fälligkeitsdatum (YYYY-MM-DD). */
  dueDate?: string | null;
  now?: Date;
}): PaymentState {
  if (p.paid) {
    return {
      key: "paid",
      label: "Bezahlt",
      className: "bg-green-100 text-green-800 border-green-200",
      detail: p.paidAt ? `Eingang ${formatDateBerlin(p.paidAt)}` : "Zahlungseingang bestätigt",
    };
  }
  const terms = paymentTerms({
    bookedAt: p.bookedAt,
    startsOn: p.startsOn,
    paymentDueDays: p.paymentDueDays,
  });
  const now = p.now ?? new Date();
  const immediate = p.method ? p.method === 'immediate' : terms.immediate;
  const dueDate = p.dueDate ? new Date(`${p.dueDate}T23:59:59`) : terms.dueDate;
  const dueLabel = p.dueDate ? formatDateBerlin(p.dueDate) : terms.dueDateLabel;
  if (immediate) {
    return {
      key: "immediate",
      label: "Sofortzahlung erwartet",
      className: "bg-orange-100 text-orange-800 border-orange-200",
      detail: "Echtzeit-/Sofortüberweisung – kurzfristige Buchung",
    };
  }
  if (dueDate.getTime() < now.getTime()) {
    return {
      key: "overdue",
      label: "Nicht bezahlt (überfällig)",
      className: "bg-red-100 text-red-800 border-red-200",
      detail: `Fällig war der ${dueLabel}`,
    };
  }
  return {
    key: "expected",
    label: "Zahlung erwartet",
    className: "bg-amber-100 text-amber-900 border-amber-200",
    detail: `Fällig bis ${dueLabel}`,
  };
}
