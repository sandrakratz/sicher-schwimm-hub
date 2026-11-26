// Rückfragen (Fenster „Das passiert“) vor Platzangebot oder Direktbuchung.
import { askConfirm } from "@/components/admin/confirm-store";
import { checkFit } from "@/lib/swim-fit";
import type { WaitlistEntry, WaitlistProgram } from "./logic";

/** Rückfrage „Mindestalter zum Kursbeginn nicht erreicht“ vor einem Angebot. */
export const confirmTooYoung = (e: WaitlistEntry) =>
  askConfirm({
    title: "Mindestalter nicht erreicht",
    consequence: `${e.child_name} erreicht zum Kursbeginn das Mindestalter noch nicht. Wenn du trotzdem anbietest, bekommen die Eltern das Angebot per E-Mail. Du kannst das Angebot danach zurückziehen.`,
    confirmLabel: "Trotzdem anbieten",
  });

/** „Passt das?“-Prüfung vor Angebot/Buchung; false = abgebrochen. */
export async function confirmFit(
  e: WaitlistEntry,
  program: WaitlistProgram | null,
  verb: "anbieten" | "buchen",
) {
  const fit = checkFit(e.notes, program);
  if (fit.ok) return true;
  return askConfirm({
    title: "Passt laut Prüfung nicht",
    consequence: (
      <>
        Laut Prüfung passt das nicht:
        <ul className="my-1 list-disc pl-5">
          {fit.issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        {verb === "anbieten"
          ? "Wenn du trotzdem anbietest, bekommen die Eltern das Angebot per E-Mail. Du kannst es danach zurückziehen."
          : "Wenn du trotzdem buchst, bekommen die Eltern sofort die Buchungsbestätigung per E-Mail."}
      </>
    ),
    confirmLabel: verb === "anbieten" ? "Trotzdem anbieten" : "Trotzdem buchen",
  });
}
