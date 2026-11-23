import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TransferParticipantDialog } from "@/components/admin/TransferParticipantDialog";
import { combineReason } from "@/lib/decline-reasons";
import { moveParticipantToWaitlist } from "@/lib/course-assignment.functions";
import { syncMemberPrices } from "@/lib/membership.functions";
import {
  cancelCourseParticipant,
  removeCourseParticipant,
} from "@/lib/participants-admin.functions";
import { cancelPaymentMail, schedulePaymentMail } from "@/lib/payment-notify-client";
import { AddParticipantForm } from "@/components/admin/kurse/AddParticipantForm";
import { EditParticipantDialog } from "@/components/admin/kurse/EditParticipantDialog";
import {
  CancelParticipantDialog,
  RemoveParticipantDialog,
} from "@/components/admin/kurse/ParticipantDialogs";
import { ParticipantRow } from "@/components/admin/kurse/ParticipantRow";
import { RequestDialog } from "@/components/admin/kurse/RequestDialog";
import { useCourseMailings } from "@/components/admin/kurse/useCourseMailings";
import {
  courseLabel,
  type Course,
  type CourseCounts,
  type CourseRequest,
  type Participant,
  type ProgramRow,
} from "@/components/admin/kurse/shared";
import {
  isDeadBooking,
  paymentOf,
  type ParticipantList,
} from "@/components/admin/kurse/useParticipants";

type RemoveState = Parameters<typeof RemoveParticipantDialog>[0]["state"];

const PAY_RANK: Record<string, number> = { immediate: 0, overdue: 1, expected: 2, paid: 3 };

const errorText = (e: unknown, fallback: string) =>
  (e as { message?: string } | null)?.message || fallback;

/** Teilnehmerliste eines Kurses mit Zahlungsfilter, Aktionen und „Teilnehmer hinzufügen“. */
export function ParticipantsDialog({
  list,
  counts,
  programs,
  courses,
}: {
  list: ParticipantList;
  counts: Record<string, CourseCounts>;
  programs: ProgramRow[];
  /** Alle Kurse, als Ziel für Umbuchungen */
  courses: Course[];
}) {
  const { course, participants, pendingMoveOut, refresh } = list;
  const removeParticipantFn = useServerFn(removeCourseParticipant);
  const moveToWaitlistFn = useServerFn(moveParticipantToWaitlist);
  const cancelParticipantFn = useServerFn(cancelCourseParticipant);
  const syncMemberPricesFn = useServerFn(syncMemberPrices);
  const { reminding, handleSendReminders } = useCourseMailings();

  // Abgesagte Buchungen (Status „cancelled“) sind standardmäßig ausgeblendet
  const [showCancelled, setShowCancelled] = useState(false);
  const [payFilter, setPayFilter] = useState("all");
  const [paySort, setPaySort] = useState("name");
  const [editPart, setEditPart] = useState<Participant | null>(null);
  const [transferPart, setTransferPart] = useState<Participant | null>(null);
  const [cancelFor, setCancelFor] = useState<Participant | null>(null);
  const [cancelCategory, setCancelCategory] = useState("");
  const [cancelDetail, setCancelDetail] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [removeState, setRemoveState] = useState<RemoveState>(null);
  const [removing, setRemoving] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqRow, setReqRow] = useState<CourseRequest | null>(null);

  const visibleParticipants = useMemo(() => {
    let rows = showCancelled
      ? participants
      : participants.filter((p) => p.status !== "cancelled" || pendingMoveOut.has(p.id));
    if (payFilter !== "all") {
      rows = rows.filter((p) => {
        if (isDeadBooking(p)) return false;
        const key = paymentOf(p, course).key;
        return payFilter === "open" ? key !== "paid" : key === payFilter;
      });
    }
    const payRank = (p: Participant) => (isDeadBooking(p) ? 4 : PAY_RANK[paymentOf(p, course).key]);
    const due = (p: Participant) => p.payment_due_date || "9999-12-31";
    return [...rows].sort((a, b) =>
      paySort === "payment"
        ? payRank(a) - payRank(b)
        : paySort === "due"
          ? due(a).localeCompare(due(b))
          : (a.participant_name || "").localeCompare(b.participant_name || ""),
    );
  }, [participants, payFilter, paySort, course, showCancelled, pendingMoveOut]);
  const cancelledCount = participants.filter(
    (p) => p.status === "cancelled" && !pendingMoveOut.has(p.id),
  ).length;

  async function openRequest(requestId: string) {
    setReqOpen(true);
    setReqRow(null);
    setReqLoading(true);
    const { data, error } = await supabase
      .from("course_requests")
      .select(
        "id,created_at,status,parent_name,parent_email,parent_phone,child_name,child_dob,swimming_level,desired_course,health_info,message,admin_notes,contact_permission",
      )
      .eq("id", requestId)
      .maybeSingle();
    setReqLoading(false);
    if (error) return void toast.error(error.message);
    if (!data) return void toast.error("Anfrage nicht gefunden");
    setReqRow(data as CourseRequest);
  }

  async function updateStatus(p: Participant, status: Participant["status"]) {
    if (status === "waiting") {
      // Zugeteiltes Kind zurück auf die Warteliste: Platz freigeben und
      // Wartelisteneintrag (wieder-)herstellen, damit niemand verloren geht.
      try {
        await moveToWaitlistFn({ data: { participantId: p.id } });
        toast.success("Zurück auf die Warteliste gesetzt");
      } catch (e) {
        return toast.error(errorText(e, "Verschieben auf die Warteliste fehlgeschlagen"));
      }
      return refresh();
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
    if (error) return toast.error(error.message);
    await refresh();
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
          removeState.blocklist ? "Entfernt und auf die Sperrliste gesetzt" : "Entfernt",
          res?.emailed ? "E-Mail an die Eltern versendet" : null,
        ]
          .filter(Boolean)
          .join(" · "),
      );
      setRemoveState(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Entfernen fehlgeschlagen");
    } finally {
      setRemoving(false);
    }
  }

  async function syncPrices() {
    if (!course) return;
    try {
      const res = await syncMemberPricesFn({ data: { courseId: course.id } });
      const parts: string[] = [];
      if (res.updated.length)
        parts.push(
          `${res.updated.length} Kursgebühr(en) angepasst: ${res.updated.map((u) => `${u.participant} ${u.from ?? "–"} → ${u.to} €`).join(", ")}`,
        );
      if (res.keptPrice.length)
        parts.push(
          `Mitglied erkannt, aber individueller Preis bleibt: ${res.keptPrice.join(", ")}`,
        );
      if (res.alreadyPaid.length)
        parts.push(`Mitglied, aber bereits bezahlt (bitte prüfen): ${res.alreadyPaid.join(", ")}`);
      if (parts.length) toast.success(parts.join(" · "), { duration: 10000 });
      else toast.success("Alles aktuell – keine Anpassung nötig");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Abgleich fehlgeschlagen");
    }
  }

  async function savePart() {
    if (!editPart) return;
    if (!editPart.participant_name?.trim()) return toast.error("Name erforderlich");
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
    if (error) return toast.error(error.message);
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
    if (error) return toast.error(error.message);
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
    // Nur die Teilnehmerliste: Zahlungen ändern die Kennzahlen der Kursliste erst beim nächsten Laden
    await refresh(false);
  }

  /** Rechnungsanschrift liegt am Teilnehmer, nicht an der Anfrage. */
  const requestAddress = (() => {
    const p = reqRow && participants.find((x) => x.request_id === reqRow.id);
    if (!p || !(p.payer_street || p.payer_zip || p.payer_city)) return null;
    return [p.payer_street, [p.payer_zip, p.payer_city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");
  })();

  const cnt = course ? counts[course.id] || { confirmed: 0, waiting: 0 } : null;
  const max = course?.max_participants ?? null;

  return (
    <>
      <Dialog open={list.open} onOpenChange={list.setOpen}>
        <DialogContent className="w-[95vw] max-w-[1400px] sm:max-w-[1400px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Teilnehmer: {course?.name}</DialogTitle>
            {course && (
              <div className="text-sm font-medium text-muted-foreground">
                Kurs: {courseLabel(course)}
              </div>
            )}
          </DialogHeader>
          {cnt && (
            <div className="text-sm text-muted-foreground mb-2">
              Bestätigt: <span className="font-semibold text-foreground">{cnt.confirmed}</span>
              {max != null && (
                <>
                  {" "}
                  von {max} · Frei:{" "}
                  <span className="font-semibold text-foreground">
                    {Math.max(0, max - cnt.confirmed)}
                  </span>
                </>
              )}
              {cnt.waiting > 0 && (
                <>
                  {" "}
                  · Warteliste: <span className="font-semibold text-foreground">{cnt.waiting}</span>
                </>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs text-muted-foreground">Zahlungsstatus:</span>
            <Select value={payFilter} onValueChange={setPayFilter}>
              <SelectTrigger className="h-8 w-[220px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="open">Alle offenen</SelectItem>
                <SelectItem value="expected">Zahlung erwartet</SelectItem>
                <SelectItem value="immediate">Sofortzahlung erwartet</SelectItem>
                <SelectItem value="overdue">Nicht bezahlt (überfällig)</SelectItem>
                <SelectItem value="paid">Bezahlt</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">Sortierung:</span>
            <Select value={paySort} onValueChange={setPaySort}>
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="payment">Zahlungsstatus (dringend zuerst)</SelectItem>
                <SelectItem value="due">Fälligkeitsdatum</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {visibleParticipants.length} von{" "}
              {showCancelled ? participants.length : participants.length - cancelledCount}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={reminding}
              onClick={() => handleSendReminders(course?.id ?? null)}
            >
              {reminding ? "Sende…" : "Zahlungserinnerung senden"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              title="Erkennt bestehende Mitgliedschaften und setzt bei offenen Buchungen den Mitgliedspreis"
              onClick={syncPrices}
            >
              Mitgliedspreise abgleichen
            </Button>
          </div>
          {cancelledCount > 0 && (
            <label className="mb-2 flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={showCancelled} onCheckedChange={(v) => setShowCancelled(!!v)} />
              Abgesagte Buchungen anzeigen ({cancelledCount})
            </label>
          )}
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Geburtsdatum</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mitglied</TableHead>
                  <TableHead>Ergebnis</TableHead>
                  <TableHead>Zahlungsstatus</TableHead>
                  <TableHead>Notiz</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleParticipants.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-6 text-muted-foreground text-xs"
                    >
                      Noch keine Teilnehmer.
                    </TableCell>
                  </TableRow>
                )}
                {visibleParticipants.map((p) => (
                  <ParticipantRow
                    key={p.id}
                    p={p}
                    course={course}
                    consent={list.consents[p.id]}
                    parentName={p.request_id ? list.requestParent[p.request_id] || null : null}
                    health={p.request_id ? list.requestHealth[p.request_id] : null}
                    onOpenRequest={openRequest}
                    onStatus={(s) => updateStatus(p, s)}
                    onTogglePaid={(paid) => togglePaid(p, paid)}
                    onEdit={() => setEditPart(p)}
                    onTransfer={() => setTransferPart(p)}
                    onRemove={() =>
                      setRemoveState({
                        participant: p,
                        reason: p.paid ? "" : "Nichtzahlung",
                        blocklist: !p.paid,
                        notify: p.paid ? "agreed" : "unpaid",
                        note: "",
                      })
                    }
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {course && (
            <AddParticipantForm
              course={course}
              programs={programs}
              waitlist={list.waitlist}
              onAdded={refresh}
            />
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => list.setOpen(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RequestDialog
        open={reqOpen}
        onOpenChange={setReqOpen}
        loading={reqLoading}
        request={reqRow}
        address={requestAddress}
      />

      <TransferParticipantDialog
        participant={transferPart}
        courses={courses
          .filter((c) => !c.archived_at)
          .map((c) => ({
            id: c.id,
            name: c.name,
            schedule: c.schedule,
            location: c.location,
            free:
              c.max_participants != null
                ? c.max_participants - (counts[c.id]?.confirmed ?? 0)
                : null,
          }))}
        onClose={() => setTransferPart(null)}
        onDone={async () => {
          setTransferPart(null);
          await refresh();
        }}
      />

      <EditParticipantDialog
        editPart={editPart}
        setEditPart={setEditPart}
        course={course}
        canManage
        requestHealth={list.requestHealth}
        requestParent={list.requestParent}
        onSave={savePart}
      />

      <CancelParticipantDialog
        participant={cancelFor}
        busy={cancelBusy}
        category={cancelCategory}
        detail={cancelDetail}
        onCategory={setCancelCategory}
        onDetail={setCancelDetail}
        onClose={() => setCancelFor(null)}
        onConfirm={confirmCancel}
      />

      <RemoveParticipantDialog
        state={removeState}
        setState={setRemoveState}
        removing={removing}
        onConfirm={confirmRemove}
      />
    </>
  );
}
