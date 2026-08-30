import { BILLING } from "@/lib/billing-config";
import { cn } from "@/lib/utils";

type Props = {
  /** "full" zeigt zusätzlich Bank und Verwendungszweck. */
  variant?: "full" | "compact";
  withPurpose?: boolean;
  className?: string;
};

/**
 * Zentrale Darstellung der Vereins-Bankverbindung.
 * Wird auf der Kursübersicht, den Kursdetailseiten und in den
 * Kursteilnahmebedingungen verwendet.
 */
export function BankDetails({ variant = "full", withPurpose, className }: Props) {
  const showPurpose = withPurpose ?? variant === "full";
  return (
    <dl className={cn("grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]", className)}>
      <dt className="font-semibold text-foreground">Kontoinhaber</dt>
      <dd className="text-muted-foreground break-words">{BILLING.recipient}</dd>
      <dt className="font-semibold text-foreground">IBAN</dt>
      <dd className="text-muted-foreground break-words">{BILLING.iban}</dd>
      <dt className="font-semibold text-foreground">BIC</dt>
      <dd className="text-muted-foreground break-words">{BILLING.bic}</dd>
      {variant === "full" && (
        <>
          <dt className="font-semibold text-foreground">Bank</dt>
          <dd className="text-muted-foreground break-words">{BILLING.bankName}</dd>
        </>
      )}
      {showPurpose && (
        <>
          <dt className="font-semibold text-foreground">Verwendungszweck</dt>
          <dd className="text-muted-foreground break-words">{BILLING.purpose}</dd>
        </>
      )}
    </dl>
  );
}
