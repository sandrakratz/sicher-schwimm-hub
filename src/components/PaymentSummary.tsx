import { CalendarClock, Euro, Zap } from "lucide-react";
import { BILLING } from "@/lib/billing-config";
import { formatPrice } from "@/lib/format";
import { paymentTerms } from "@/lib/payment-status";

interface Props {
  startsOn?: string | null;
  paymentDueDays?: number | null;
  amount?: number | null;
  bookedAt?: string | null;
  /** Kompakte Variante für den Bestätigungsdialog. */
  compact?: boolean;
}

/** Kompakte Zusammenfassung der Zahlungsbedingungen inkl. konkretem Fälligkeitsdatum. */
export function PaymentSummary({ startsOn, paymentDueDays, amount, bookedAt, compact }: Props) {
  const terms = paymentTerms({ bookedAt, startsOn, paymentDueDays });
  return (
    <div
      className={`rounded-lg border p-3 text-sm ${
        terms.immediate
          ? "border-orange-200 bg-orange-50 text-orange-900"
          : "border-primary/20 bg-primary/5 text-primary-deep"
      }`}
    >
      <div className="font-semibold flex items-center gap-2 mb-1.5">
        {terms.immediate ? <Zap className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
        Zahlungsbedingungen
      </div>
      <ul className="space-y-1">
        {amount != null && (
          <li className="flex items-center gap-2">
            <Euro className="h-3.5 w-3.5 shrink-0" />
            Kursgebühr: <strong>{formatPrice(amount)}</strong>
          </li>
        )}
        <li>
          Zahlungsart: <strong>{terms.methodLabel}</strong>
        </li>
        <li>
          {terms.immediate ? "Fällig: " : "Fällig bis spätestens: "}
          <strong>{terms.dueDateLabel}</strong>
        </li>
      </ul>
      <p className="mt-2 text-xs opacity-90">{terms.note}</p>
      {!compact && (
        <p className="mt-1 text-xs opacity-90">
          Verwendungszweck: Name des Kindes und Kursbeginn. Bankverbindung: {BILLING.iban} ({BILLING.bankName}).
        </p>
      )}
    </div>
  );
}
