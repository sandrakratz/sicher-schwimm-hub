import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";

/**
 * Anwesenheit einer Trainer:in korrigieren (statt Browser-Eingabefenster). Die Korrektur gilt sofort
 * als bestätigt und wirkt damit auf die Übungsleiter-Abrechnung – das sagt das Fenster vorher.
 */
export function AttendanceCorrectDialog({
  trainerName,
  present,
  busy,
  onClose,
  onConfirm,
}: {
  trainerName: string;
  /** Ziel: true = als anwesend eintragen, false = als nicht anwesend */
  present: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  return (
    <ConfirmActionDialog
      title={
        present
          ? `${trainerName} als anwesend eintragen`
          : `${trainerName} als nicht anwesend eintragen`
      }
      consequence={
        present ? (
          <>
            {trainerName} gilt für diesen Termin als anwesend. Die Eintragung ist sofort bestätigt
            und zählt für die Übungsleiter-Abrechnung.
          </>
        ) : (
          <>
            {trainerName} gilt für diesen Termin als nicht anwesend. Die Eintragung ist sofort
            bestätigt; der Termin zählt nicht für die Übungsleiter-Abrechnung.
          </>
        )
      }
      reason={{
        label: "Grund",
        placeholder: present ? "z. B. vergessen einzutragen" : "z. B. nach der 1. Stunde gegangen",
      }}
      confirmLabel={present ? "Als anwesend eintragen" : "Als nicht anwesend eintragen"}
      destructive={!present}
      busy={busy}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
