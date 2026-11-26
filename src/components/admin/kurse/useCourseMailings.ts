import { askConfirm } from "@/components/admin/confirm-store";
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
      !(await askConfirm({
        title: "Abmelde-Link per Mail senden?",
        consequence:
          "Eine einmalige Info-Mail mit dem Abmelde-Link geht jetzt an alle Familien mit bereits laufenden Kursen. Jede Adresse bekommt diese Mail nur ein einziges Mal, pro Klick werden bis zu 12 Familien bedient. Gesendete Mails kannst du nicht zurückholen.",
        confirmLabel: "Mail senden",
      }))
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
      !(await askConfirm({
        title: "Info-Mail zu Handy-Mitteilungen senden?",
        consequence:
          "Die Info-Mail zu den Handy-Mitteilungen geht jetzt an alle Familien mit laufenden Kursen. Jede Familie bekommt diese Mail nur ein einziges Mal. Gesendete Mails kannst du nicht zurückholen.",
        confirmLabel: "Mail senden",
      }))
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
      !(await askConfirm({
        title: "Zahlungserinnerungen senden?",
        consequence: courseId
          ? "Alle offenen Fälle dieses Kurses (Sofortzahlung erwartet oder überfällig) bekommen jetzt eine Zahlungserinnerung per E-Mail. Gesendete Mails kannst du nicht zurückholen."
          : "Alle offenen Fälle aus allen Kursen (Sofortzahlung erwartet oder überfällig) bekommen jetzt eine Zahlungserinnerung per E-Mail. Gesendete Mails kannst du nicht zurückholen.",
        confirmLabel: "Erinnerungen senden",
      }))
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
