import { Plus } from "lucide-react";
import { MoreMenu } from "@/components/admin/MoreMenu";
import { formatDateBerlin } from "@/lib/format";
import type { SessionCancellation } from "@/lib/session-cancel.functions";
import { AttendanceBoard } from "@/components/AttendanceBoard";
import { TrainerAttendancePanel } from "@/components/TrainerAttendancePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseSessionList } from "@/lib/session-list";
import type { TrainerOption } from "@/lib/trainers.functions";
import type { Course } from "@/components/admin/kurse/shared";

export type SessionRow = {
  id: string;
  session_index: number;
  session_date: string;
  start_time?: string | null;
  end_time?: string | null;
  assigned_trainer_id?: string | null;
};

/** Termine eines Kurses: anlegen, importieren, Anwesenheit; Einteilung nur anzeigen (eingeteilt wird im Dienstplan). */
export function SessionsDialog({
  open,
  onOpenChange,
  course,
  sessions,
  availability,
  assignments,
  trainers,
  bulkText,
  setBulkText,
  bulkBusy,
  onImport,
  onAdd,
  onRemove,
  onCancel,
  cancellations,
  onDateChange,
  onTimeChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course | null;
  sessions: SessionRow[];
  availability: { session_id: string; trainer_id: string; available: boolean }[];
  assignments: { session_id: string; trainer_id: string }[];
  trainers: TrainerOption[];
  bulkText: string;
  setBulkText: (text: string) => void;
  bulkBusy: boolean;
  onImport: () => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  /** „Termin fällt aus“ öffnen */
  onCancel: (s: SessionRow) => void;
  /** Bereits ausgefallene Termine (Protokoll) */
  cancellations: SessionCancellation[];
  onDateChange: (id: string, date: string) => void;
  onTimeChange: (id: string, field: "start_time" | "end_time", value: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kurstermine: {course?.name}</DialogTitle>
        </DialogHeader>
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <Label className="text-sm font-semibold">Terminliste einfügen</Label>
          <p className="text-xs text-muted-foreground">
            Eine Zeile pro Termin, Uhrzeit optional. Pausen mit „—“ oder „kein Termin“ markieren.
            Kursbeginn und -ende werden automatisch übernommen, Eltern sehen die Liste auf der
            Kursseite.
          </p>
          <Textarea
            rows={6}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={
              "1  07.11.2026  11:00–11:45 Uhr\n2  14.11.2026  11:00–11:45 Uhr\n—  26.12.2026  kein Termin – Weihnachtspause\n3  09.01.2027"
            }
          />
          {bulkText.trim() &&
            (() => {
              const p = parseSessionList(bulkText);
              return (
                <p className="text-xs text-muted-foreground">
                  Erkannt: {p.filter((x) => !x.isBreak).length} Termine,{" "}
                  {p.filter((x) => x.isBreak).length} Pausen
                </p>
              );
            })()}
          <Button size="sm" onClick={onImport} disabled={bulkBusy || !bulkText.trim()}>
            {bulkBusy ? "Übernehme…" : "Termine übernehmen"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Bis zu 30 Termine mit Datum und Uhrzeit. Das Datum erscheint zusätzlich als
            Spaltenüberschrift der Excel-Kursliste. Grün/rot = Rückmeldung der Trainer:innen.
          </p>
          {course && (
            <Button asChild size="sm">
              <a href={`/admin/dienstplan?tab=einteilen&kurs=${course.id}`}>
                Im Dienstplan einteilen
              </a>
            </Button>
          )}
        </div>
        <div className="space-y-3">
          {sessions.length === 0 && (
            <div className="text-sm text-muted-foreground">Noch keine Termine.</div>
          )}
          {sessions.map((s) => {
            const nameOf = (id: string) => trainers.find((t) => t.id === id)?.name || "Unbekannt";
            const yes = availability.filter((a) => a.session_id === s.id && a.available);
            const no = availability.filter((a) => a.session_id === s.id && !a.available);
            const assignedIds = assignments
              .filter((a) => a.session_id === s.id)
              .map((a) => a.trainer_id);
            const declined = assignedIds.filter((id) => no.some((n) => n.trainer_id === id));
            return (
              <div key={s.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 text-sm text-muted-foreground">{s.session_index}.</span>
                  <Input
                    type="date"
                    // Erst beim Verlassen des Feldes / mit Enter speichern: sonst wird jeder Zwischenwert
                    // beim Tippen, Pfeiltasten oder Mausrad sofort als Termin gespeichert.
                    key={`${s.id}-${s.session_date}`}
                    defaultValue={s.session_date}
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (v && v !== s.session_date) onDateChange(s.id, v);
                      else e.target.value = s.session_date;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                  <Input
                    type="time"
                    className="w-28"
                    title="Beginn"
                    value={(s.start_time || "").slice(0, 5)}
                    onChange={(e) => onTimeChange(s.id, "start_time", e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">bis</span>
                  <Input
                    type="time"
                    className="w-28"
                    title="Ende"
                    value={(s.end_time || "").slice(0, 5)}
                    onChange={(e) => onTimeChange(s.id, "end_time", e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    title="Termin findet nicht statt – mit Grund, Eltern und Trainer:innen auf Wunsch informieren"
                    onClick={() => onCancel(s)}
                  >
                    Fällt aus …
                  </Button>
                  <MoreMenu
                    items={[
                      {
                        label: "Fehleintrag löschen …",
                        hint: "Nur für versehentlich angelegte Termine – ohne Protokoll, ohne Nachricht",
                        destructive: true,
                        onSelect: () => onRemove(s.id),
                      },
                    ]}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-10 text-xs">
                  {yes.map((a) => (
                    <Badge
                      key={a.trainer_id}
                      className="border-transparent bg-green-600 text-white"
                    >
                      {nameOf(a.trainer_id)}
                    </Badge>
                  ))}
                  {no.map((a) => (
                    <Badge key={a.trainer_id} className="border-transparent bg-red-600 text-white">
                      {nameOf(a.trainer_id)}
                    </Badge>
                  ))}
                  {yes.length === 0 && no.length === 0 && (
                    <span className="text-muted-foreground">Noch keine Rückmeldungen</span>
                  )}
                </div>
                {/* Einteilen nur im Dienstplan (mit Protokoll und Mail an die Trainer:innen); hier nur Anzeige */}
                <div className="space-y-1 pl-10 text-xs">
                  <span className="text-muted-foreground">Eingeteilt: </span>
                  {assignedIds.length > 0 && (
                    <span className="font-medium">{assignedIds.map(nameOf).join(", ")}</span>
                  )}
                  {assignedIds.length === 0 && (
                    <span className="text-xs text-orange-600">Noch niemand eingeteilt</span>
                  )}
                  {declined.length > 0 && (
                    <span className="text-xs text-red-600">
                      Abgesagt, aber eingeteilt: {declined.map(nameOf).join(", ")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {cancellations.length > 0 && (
          <div className="space-y-1 rounded-md border border-dashed p-3 text-sm">
            <h3 className="font-semibold">Ausgefallene Termine</h3>
            {cancellations.map((c) => (
              <div key={c.id} className="text-xs">
                <span className="font-medium">
                  {formatDateBerlin(c.session_date)}
                  {c.start_time ? `, ${c.start_time.slice(0, 5)} Uhr` : ""}
                </span>
                {" – "}
                {c.reason}
                <span className="text-muted-foreground">
                  {" "}
                  · eingetragen {formatDateBerlin(c.cancelled_at)} · informiert:{" "}
                  {c.parents_notified} Familie(n), {c.trainers_notified} Trainer:in(nen)
                </span>
              </div>
            ))}
          </div>
        )}
        {course && (
          <div className="mt-4 space-y-2 border-t pt-4">
            <h3 className="text-sm font-semibold">Anwesenheit</h3>
            <AttendanceBoard courseId={course.id} editableHints />
            <h3 className="pt-4 text-sm font-semibold">Trainer-Anwesenheit (Steuernachweis)</h3>
            <TrainerAttendancePanel courseId={course.id} />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
          <Button onClick={onAdd} disabled={sessions.length >= 30}>
            <Plus className="h-4 w-4" /> Termin hinzufügen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
