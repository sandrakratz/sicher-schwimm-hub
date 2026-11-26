import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import { TransferParticipantDialog } from "@/components/admin/TransferParticipantDialog";
import { errorText } from "@/lib/format";
import { combineReason } from "@/lib/decline-reasons";
import { moveParticipantToWaitlist } from "@/lib/course-assignment.functions";
import {
  cancelCourseParticipant,
  removeCourseParticipant,
} from "@/lib/participants-admin.functions";
import { cancelPaymentMail, schedulePaymentMail } from "@/lib/payment-notify-client";
import { EditParticipantDialog } from "@/components/admin/kurse/EditParticipantDialog";
import {
  CancelParticipantDialog,
  RemoveParticipantDialog,
} from "@/components/admin/kurse/ParticipantDialogs";
import type { Course, Participant } from "@/components/admin/kurse/shared";

type RemoveState = Parameters<typeof RemoveParticipantDialog>[0]["state"];
type TransferCourses = Parameters<typeof TransferParticipantDialog>[0]["courses"];

/**
 * Alle Aktionen an einer Buchung: Status, bezahlt, bearbeiten, umbuchen, Absage, entfernen.
 * Gemeinsam für die Teilnehmerliste eines Kurses und die Familienakte – eine Logik, ein Ort.
 * `refresh(false)` lädt nur die Liste neu, ohne die Kennzahlen der Kursübersicht.
 */
export function useParticipantActions(refresh: (withCourses?: boolean) => Promise<void>) {
  const removeParticipantFn = useServerFn(removeCourseParticipant);
  const moveToWaitlistFn = useServerFn(moveParticipantToWaitlist);
  const cancelParticipantFn = useServerFn(cancelCourseParticipant);

  const [editPart, setEditPart] = useState<Participant | null>(null);
  const [transferPart, setTransferPart] = useState<Participant | null>(null);
  const [cancelFor, setCancelFor] = useState<Participant | null>(null);
  const [cancelCategory, setCancelCategory] = useState("");
  const [cancelDetail, setCancelDetail] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [moveFor, setMoveFor] = useState<Participant | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [removeState, setRemoveState] = useState<RemoveState>(null);
  const [removing, setRemoving] = useState(false);

  async function updateStatus(p: Participant, status: Participant["status"]) {
    if (status === "waiting") {
      // Erst nach Rückfrage (Dialog „Das passiert“), siehe confirmMoveToWaitlist
      setMoveFor(p);
      return;
    }
    if (status === "cancelled") {
      // Absage durch die Familie: Grund per Auswahl erfassen (Dialog), Zeitpunkt und Grund werden
      // gespeichert, damit sie in der Anfrageliste (Reiter „Absagen“) und im Sperrvorschlag mitzählt.
      setCancelCategory("");
      setCancelDetail("");
      setCancelFor(p);
      return;
    }
    const { error } = await supabase.from("course_participants").update({ status }).eq("id", p.id);
    if (error) return void toast.error(error.message);
    await refresh();
  }

  /** Zugeteiltes Kind zurück auf die Warteliste: Platz freigeben, Wartelisteneintrag (wieder-)herstellen. */
  async function confirmMoveToWaitlist(note: string) {
    if (!moveFor) return;
    setMoveBusy(true);
    try {
      await moveToWaitlistFn({ data: { participantId: moveFor.id, note: note || undefined } });
      toast.success(`${moveFor.participant_name ?? "Kind"} steht wieder auf der Warteliste`);
      setMoveFor(null);
      await refresh();
    } catch (e) {
      toast.error(errorText(e, "Verschieben auf die Warteliste fehlgeschlagen"));
    } finally {
      setMoveBusy(false);
    }
  }

  async function confirmCancel() {
    if (!cancelFor) return;
    setCancelBusy(true);
    try {
      await cancelParticipantFn({
        data: {
          participantId: cancelFor.id,
          reason: combineReason(cancelCategory, cancelDetail) ?? "",
        },
      });
      toast.success("Absage erfasst – der Platz ist frei und zählt in der Anfrageliste mit");
      setCancelFor(null);
      await refresh();
    } catch (e) {
      toast.error(errorText(e, "Absage konnte nicht erfasst werden"));
    } finally {
      setCancelBusy(false);
    }
  }

  function startRemove(p: Participant) {
    setRemoveState({
      participant: p,
      reason: p.paid ? "" : "Nichtzahlung",
      blocklist: !p.paid,
      notify: p.paid ? "agreed" : "unpaid",
      note: "",
    });
  }

  async function confirmRemove() {
    if (!removeState) return;
    setRemoving(true);
    try {
      const res = (await removeParticipantFn({
        data: {
          participantId: removeState.participant.id,
          reason: removeState.reason,
          blocklist: removeState.blocklist,
          notify: removeState.participant.participant_email ? removeState.notify : "none",
          note: removeState.note,
        },
      })) as { emailed?: boolean } | null;
      toast.success(
        [
          removeState.blocklist
            ? "Aus dem Kurs genommen und auf die Sperrliste gesetzt"
            : "Aus dem Kurs genommen – die Buchung bleibt mit Grund sichtbar",
          res?.emailed ? "E-Mail an die Eltern versendet" : null,
        ]
          .filter(Boolean)
          .join(" · "),
      );
      setRemoveState(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aus dem Kurs nehmen fehlgeschlagen");
    } finally {
      setRemoving(false);
    }
  }

  async function savePart() {
    if (!editPart) return;
    if (!editPart.participant_name?.trim()) return void toast.error("Name erforderlich");
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const memberConfirmedChanged = editPart.member_confirmed && !editPart.member_confirmed_at;
    const { error } = await supabase
      .from("course_participants")
      .update({
        participant_name: editPart.participant_name.trim(),
        participant_email: editPart.participant_email?.trim() || null,
        participant_phone: editPart.participant_phone?.trim() || null,
        date_of_birth: editPart.date_of_birth || null,
        status: editPart.status,
        notes: editPart.notes?.trim() || null,
        internal_notes: editPart.internal_notes?.trim() || null,
        paid: editPart.paid,
        paid_at: editPart.paid ? editPart.paid_at || new Date().toISOString() : null,
        // „bezahlt von“ / „Mitgliedschaft bestätigt von“ bleiben erhalten, solange sich der Wert nicht ändert
        paid_by: editPart.paid ? (editPart.paid_by ?? userId) : null,
        payment_note: editPart.payment_note?.trim() || null,
        is_member: editPart.is_member,
        member_confirmed: editPart.member_confirmed,
        member_confirmed_at: editPart.member_confirmed
          ? editPart.member_confirmed_at ||
            (memberConfirmedChanged ? new Date().toISOString() : null)
          : null,
        member_confirmed_by: editPart.member_confirmed
          ? (editPart.member_confirmed_by ?? userId)
          : null,
        price_amount: editPart.price_amount,
        parent_user_id: editPart.parent_user_id || null,
        payer_street: editPart.payer_street?.trim() || null,
        payer_zip: editPart.payer_zip?.trim() || null,
        payer_city: editPart.payer_city?.trim() || null,
      })
      .eq("id", editPart.id);
    if (error) return void toast.error(error.message);
    if (editPart.paid) schedulePaymentMail(editPart.id);
    else cancelPaymentMail(editPart.id);
    toast.success("Gespeichert");
    setEditPart(null);
    await refresh();
  }

  async function togglePaid(p: Participant, paid: boolean) {
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const { error } = await supabase
      .from("course_participants")
      .update({
        paid,
        paid_at: paid ? new Date().toISOString() : null,
        paid_by: paid ? userId : null,
      })
      .eq("id", p.id);
    if (error) return void toast.error(error.message);
    if (paid) schedulePaymentMail(p.id);
    else cancelPaymentMail(p.id);
    toast.success(
      paid
        ? "Als bezahlt markiert – Eltern erhalten gleich eine Bestätigung"
        : "Zahlung zurückgesetzt",
      paid
        ? { action: { label: "Rückgängig", onClick: () => void togglePaid(p, false) } }
        : undefined,
    );
    // Nur die Liste: Zahlungen ändern die Kennzahlen der Kursliste erst beim nächsten Laden
    await refresh(false);
  }

  return {
    editPart,
    setEditPart,
    transferPart,
    setTransferPart,
    cancelFor,
    setCancelFor,
    cancelCategory,
    setCancelCategory,
    cancelDetail,
    setCancelDetail,
    cancelBusy,
    moveFor,
    setMoveFor,
    moveBusy,
    confirmMoveToWaitlist,
    removeState,
    setRemoveState,
    removing,
    updateStatus,
    confirmCancel,
    startRemove,
    confirmRemove,
    savePart,
    togglePaid,
    refresh,
  };
}

export type ParticipantActions = ReturnType<typeof useParticipantActions>;

/** Die Dialoge zu den Aktionen (bearbeiten, umbuchen, Absage, entfernen). */
export function ParticipantActionDialogs({
  a,
  editCourse,
  transferCourses,
  requestHealth,
  requestParent,
}: {
  a: ParticipantActions;
  /** Kurs der gerade bearbeiteten Buchung (Altersanzeige, Preise) */
  editCourse: Course | null;
  /** Mögliche Zielkurse für eine Umbuchung */
  transferCourses: TransferCourses;
  requestHealth: Record<string, string | null>;
  requestParent: Record<string, string | null>;
}) {
  return (
    <>
      <TransferParticipantDialog
        participant={a.transferPart}
        courses={transferCourses}
        onClose={() => a.setTransferPart(null)}
        onDone={async () => {
          a.setTransferPart(null);
          await a.refresh();
        }}
      />
      <EditParticipantDialog
        editPart={a.editPart}
        setEditPart={a.setEditPart}
        course={editCourse}
        canManage
        requestHealth={requestHealth}
        requestParent={requestParent}
        onSave={a.savePart}
      />
      <CancelParticipantDialog
        participant={a.cancelFor}
        busy={a.cancelBusy}
        category={a.cancelCategory}
        detail={a.cancelDetail}
        onCategory={a.setCancelCategory}
        onDetail={a.setCancelDetail}
        onClose={() => a.setCancelFor(null)}
        onConfirm={a.confirmCancel}
      />
      {a.moveFor && (
        <ConfirmActionDialog
          title={`${a.moveFor.participant_name ?? "Kind"} zurück auf die Warteliste`}
          consequence={
            <>
              Das Kind verliert den Platz in diesem Kurs. Die Buchung bleibt als „abgesagt“ sichtbar
              und zählt nicht als Absage der Familie. Das Kind steht danach wieder auf der
              Warteliste, der frei gewordene Platz geht bei der nächsten Platzvergabe an die
              Warteliste. Es geht keine E-Mail an die Eltern.
            </>
          }
          reason={{
            label: "Vermerk für die Warteliste",
            placeholder: "z. B. Kurs passt vom Niveau noch nicht",
          }}
          confirmLabel="Auf die Warteliste setzen"
          busy={a.moveBusy}
          onClose={() => a.setMoveFor(null)}
          onConfirm={(note) => void a.confirmMoveToWaitlist(note)}
        />
      )}
      <RemoveParticipantDialog
        state={a.removeState}
        setState={a.setRemoveState}
        removing={a.removing}
        onConfirm={a.confirmRemove}
      />
    </>
  );
}
