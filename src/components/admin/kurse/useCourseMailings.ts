import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { sendPaymentReminders } from "@/lib/payment-reminders.functions";
import { sendPushInvites } from "@/lib/push.functions";
import { sendAbsenceInvites } from "@/lib/absence.functions";

/** Sammel-Mails der Kursverwaltung (Zahlungserinnerung, Info-Mails an Familien) mit Rückfrage. */
export function useCourseMailings() {
  const remindFn = useServerFn(sendPaymentReminders);
  const pushInvitesFn = useServerFn(sendPushInvites);
  const absenceInvitesFn = useServerFn(sendAbsenceInvites);
  const [reminding, setReminding] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteAbsence, setInviteAbsence] = useState(false);

  async function handleSendAbsenceInvites() {
    if (
      !confirm(
        "Einmalige Info-Mail mit dem Abmelde-Link jetzt an alle Familien mit bereits laufenden Kursen senden? Jede Adresse bekommt diese Mail nur ein einziges Mal. Es werden jeweils bis zu 12 Familien pro Klick bedient.",
      )
    )
      return;
    setInviteAbsence(true);
    try {
      const r = await absenceInvitesFn();
      if (r.sent === 0 && r.remaining === 0 && r.failed === 0)
        toast.info("Keine neuen Familien – alle haben die Mail bereits erhalten");
      else
        toast.success(
          `Mail an ${r.sent} Familien gesendet` +
            (r.failed ? `, ${r.failed} fehlgeschlagen` : "") +
            (r.remaining ? `. Noch ${r.remaining} offen – bitte erneut klicken.` : "."),
        );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Senden fehlgeschlagen");
    } finally {
      setInviteAbsence(false);
    }
  }

  async function handleSendPushInvites() {
    if (
      !confirm(
        "Info-Mail zu den Handy-Mitteilungen jetzt an alle Familien mit laufenden Kursen senden? Jede Familie bekommt diese Mail nur ein einziges Mal.",
      )
    )
      return;
    setInviting(true);
    try {
      const r = await pushInvitesFn();
      toast.success(
        r.sent > 0
          ? `Info-Mail an ${r.sent} Familien gesendet`
          : "Keine neuen Familien – alle haben die Info-Mail bereits erhalten",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Senden fehlgeschlagen");
    } finally {
      setInviting(false);
    }
  }

  async function handleSendReminders(courseId?: string | null) {
    if (
      !confirm(
        "Zahlungserinnerung an alle offenen Fälle (Sofortzahlung erwartet oder überfällig) senden?",
      )
    )
      return;
    setReminding(true);
    try {
      const res: any = await remindFn({ data: { courseId: courseId ?? null } });
      if (!res?.sentCount) toast.info("Keine offenen Fälle für eine Erinnerung gefunden.");
      else toast.success(`${res.sentCount} Zahlungserinnerung(en) versendet`);
    } catch (e: any) {
      toast.error(e?.message || "Versand fehlgeschlagen");
    } finally {
      setReminding(false);
    }
  }

  return {
    reminding,
    inviting,
    inviteAbsence,
    handleSendAbsenceInvites,
    handleSendPushInvites,
    handleSendReminders,
  };
}
