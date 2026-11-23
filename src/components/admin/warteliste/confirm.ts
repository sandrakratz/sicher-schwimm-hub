// Rückfragen (Browser-Dialog) vor Platzangebot oder Direktbuchung.
import { checkFit } from "@/lib/swim-fit";
import type { WaitlistEntry, WaitlistProgram } from "./logic";

/** Rückfrage „Mindestalter zum Kursbeginn nicht erreicht“ vor einem Angebot. */
export const confirmTooYoung = (e: WaitlistEntry) =>
  confirm(
    `${e.child_name} erreicht zum Kursbeginn das Mindestalter noch nicht. Trotzdem anbieten?`,
  );

/** „Passt das?“-Prüfung vor Angebot/Buchung; false = abgebrochen. */
export function confirmFit(e: WaitlistEntry, program: WaitlistProgram | null, verb: string) {
  const fit = checkFit(e.notes, program);
  return (
    fit.ok ||
    confirm("Passt laut Prüfung nicht:\n- " + fit.issues.join("\n- ") + `\n\nTrotzdem ${verb}?`)
  );
}
