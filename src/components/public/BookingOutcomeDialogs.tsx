import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { BookingSuccess } from "@/components/AdultBookingDialog";
import { PaymentSummary } from "@/components/PaymentSummary";

/** Hinweisfenster nach einer Buchung: beim Schließen wird die Seite neu geladen (aktuelle Platzzahlen). */
function ReloadOnCloseAlert({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description: ReactNode;
  children?: ReactNode;
}) {
  const close = () => {
    onClose();
    window.location.reload();
  };
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogAction onClick={close}>Alles klar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function BlockedBookingDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ReloadOnCloseAlert
      open={open}
      onClose={onClose}
      title="Einzelfallprüfung erforderlich"
      description="Für diese Anmeldung ist eine Einzelfallprüfung durch den Vorstand erforderlich, eine direkte Buchung ist daher nicht möglich. Wir haben Ihre Angaben als Kursanfrage aufgenommen und melden uns persönlich bei Ihnen."
    />
  );
}

function resultText(r: BookingSuccess): string {
  if (r.status === "waiting")
    return `Der Kurs „${r.courseName}“ ist inzwischen ausgebucht. Wir haben Sie auf die Warteliste gesetzt und melden uns, sobald ein Platz frei wird. Eine Bestätigung per E-Mail ist unterwegs.`;
  if (r.memberCheck)
    return `Ihre Buchung für „${r.courseName}“ ist verbindlich eingegangen. Wir prüfen Ihre Angabe zur Vereinsmitgliedschaft und schicken Ihnen danach die Zahlungsaufforderung per E-Mail. Bitte überweisen Sie bis dahin noch nichts.`;
  return `Ihre Buchung für „${r.courseName}“ ist verbindlich eingegangen. Sie erhalten in Kürze eine Bestätigung per E-Mail mit allen Zahlungsinformationen.`;
}

export function BookingResultDialog({
  result,
  onClose,
}: {
  result: BookingSuccess | null;
  onClose: () => void;
}) {
  return (
    <ReloadOnCloseAlert
      open={result !== null}
      onClose={onClose}
      title={result?.status === "waiting" ? "Auf die Warteliste gesetzt" : "Buchung bestätigt"}
      description={result ? resultText(result) : null}
    >
      {result?.status === "confirmed" && !result.memberCheck && (
        <PaymentSummary
          startsOn={result.startsOn}
          paymentDueDays={result.paymentDueDays}
          amount={result.amount}
        />
      )}
    </ReloadOnCloseAlert>
  );
}
