import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { syncMemberPrices } from "@/lib/membership.functions";
import { AddParticipantForm } from "@/components/admin/kurse/AddParticipantForm";
import { ParticipantRow } from "@/components/admin/kurse/ParticipantRow";
import { RequestDialog } from "@/components/admin/kurse/RequestDialog";
import { useCourseMailings } from "@/components/admin/kurse/useCourseMailings";
import {
  ParticipantActionDialogs,
  useParticipantActions,
} from "@/components/admin/kurse/useParticipantActions";
import {
  type Course,
  type CourseCounts,
  type CourseRequest,
  type ProgramRow,
} from "@/components/admin/kurse/shared";
import {
  isDeadBooking,
  paymentOf,
  type ParticipantList,
} from "@/components/admin/kurse/useParticipants";
import type { Participant } from "@/components/admin/kurse/shared";

const PAY_RANK: Record<string, number> = { immediate: 0, overdue: 1, expected: 2, paid: 3 };

/** Teilnehmerliste eines Kurszeitraums (eigene Seite) mit Zahlungsfilter, Aktionen und „Teilnehmer hinzufügen“. */
export function ParticipantsPanel({
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
  const syncMemberPricesFn = useServerFn(syncMemberPrices);
  const { reminding, handleSendReminders } = useCourseMailings();
  const a = useParticipantActions(refresh);

  // Abgesagte Buchungen (Status „cancelled“) sind standardmäßig ausgeblendet
  const [showCancelled, setShowCancelled] = useState(false);
  const [payFilter, setPayFilter] = useState("all");
  const [paySort, setPaySort] = useState("name");
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
      <section aria-label="Teilnehmer" className="space-y-3">
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
                  <TableCell colSpan={9} className="text-center py-6 text-muted-foreground text-xs">
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
                  onStatus={(s) => a.updateStatus(p, s)}
                  onTogglePaid={(paid) => a.togglePaid(p, paid)}
                  onEdit={() => a.setEditPart(p)}
                  onTransfer={() => a.setTransferPart(p)}
                  onRemove={() => a.startRemove(p)}
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
      </section>

      <RequestDialog
        open={reqOpen}
        onOpenChange={setReqOpen}
        loading={reqLoading}
        request={reqRow}
        address={requestAddress}
      />

      <ParticipantActionDialogs
        a={a}
        editCourse={course}
        transferCourses={courses
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
        requestHealth={list.requestHealth}
        requestParent={list.requestParent}
      />
    </>
  );
}
