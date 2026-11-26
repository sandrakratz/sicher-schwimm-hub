import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CONCERN_LABEL,
  concernTargets,
  type Concern,
  type ConcernTarget,
} from "@/lib/family-child-status";
import type { WaitlistMutations } from "@/components/admin/warteliste/useWaitlistMutations";
import type { ParticipantActions } from "@/components/admin/kurse/useParticipantActions";
import type { Participant } from "@/components/admin/kurse/shared";
import type { FamilyChild } from "./buildFamilyChildren";

const CONCERNS: Concern[] = ["leave", "decline_stay", "other_course", "sick"];

/** Was nach dem Klick passiert (Du-Form, mit Hinweis auf Mail und Weg zurück). */
function consequence(kind: ConcernTarget["kind"]): string {
  switch (kind) {
    case "unregister":
      return "Der Eintrag auf der Warteliste wird auf „Abgemeldet“ gesetzt, der Grund steht mit Datum in der Notiz. Es geht keine E-Mail an die Familie. Über „Wieder auf die Warteliste“ holst du den Eintrag zurück.";
    case "decline_leave":
      return "Der angebotene Platz wird frei und geht an das nächste Kind. Die Absage zählt mit, das Kind steht danach nicht mehr auf der Warteliste. Es geht keine E-Mail an die Familie.";
    case "decline_stay":
      return "Der angebotene Platz wird frei und geht an das nächste Kind. Die Absage zählt mit, die Familie wartet frühestens auf den nächsten Kurs. Es geht keine E-Mail an die Familie.";
    case "cancel_booking":
      return "Als Nächstes öffnet sich „Absage erfassen“, dort wählst du den Grund. Danach ist der Platz frei und die Absage zählt in der Anfrageliste mit.";
    case "transfer":
      return "Als Nächstes öffnet sich die Umbuchung, dort wählst du den neuen Kurs. Es gilt die Gebühr nach § 3 der Kursbedingungen, die Eltern stimmen per Link zu.";
  }
}

const CONFIRM_LABEL: Record<ConcernTarget["kind"], string> = {
  unregister: "Abmelden",
  decline_leave: "Absage speichern",
  decline_stay: "Absage speichern",
  cancel_booking: "Weiter zur Absage …",
  transfer: "Weiter zur Umbuchung …",
};

/**
 * „Eltern melden sich …“: ein Einstieg für alles, was Eltern von sich aus mitteilen. Wählt Kind und
 * Anliegen, zeigt „Das passiert“ und führt dann die vorhandene Aktion aus (Abmelden, Absage
 * erfassen, Umbuchen). Es gibt keine eigene Server-Logik. Nur rendern, solange der Dialog offen
 * ist, dann starten alle Felder neu.
 */
export function ParentReportDialog({
  childrenList,
  initialChild,
  initialConcern,
  participants,
  m,
  a,
  onClose,
  onDone,
}: {
  childrenList: FamilyChild[];
  initialChild: string | null;
  initialConcern: Concern | null;
  participants: Participant[];
  m: WaitlistMutations;
  a: ParticipantActions;
  onClose: () => void;
  /** Nach erfolgreicher Änderung: Familienansicht neu laden */
  onDone: () => void;
}) {
  const [childKey, setChildKey] = useState(
    initialChild ?? (childrenList.length === 1 ? (childrenList[0]?.key ?? "") : ""),
  );
  const [concern, setConcern] = useState<Concern | null>(initialConcern);
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");

  const child = childrenList.find((c) => c.key === childKey) ?? null;
  const targets = child && concern ? concernTargets(child.entries, child.bookings, concern) : [];
  const target = targets.find((t) => t.id === targetId) ?? targets[0] ?? null;
  const reasonRequired = target?.kind === "unregister";
  const busy = m.update.isPending || m.recordDecline.isPending;
  const trimmed = reason.trim();
  const usesReason =
    !!target && ["unregister", "decline_leave", "decline_stay"].includes(target.kind);

  const finish = () => {
    onDone();
    onClose();
  };

  const run = () => {
    if (!target) return;
    switch (target.kind) {
      case "unregister":
        m.update.mutate(
          {
            entryId: target.id,
            status: "removed",
            appendNote: `Abgemeldet – Grund: ${trimmed}`,
          },
          {
            onSuccess: () => {
              toast.success("Abgemeldet – der Grund steht in der Notiz");
              finish();
            },
          },
        );
        break;
      case "decline_leave":
      case "decline_stay":
        m.recordDecline.mutate(
          {
            entryId: target.id,
            stay: target.kind === "decline_stay",
            availableFrom: null,
            reason: trimmed || null,
          },
          { onSuccess: finish },
        );
        break;
      case "cancel_booking": {
        const p = participants.find((x) => x.id === target.id);
        onClose();
        if (p) void a.updateStatus(p, "cancelled");
        break;
      }
      case "transfer": {
        const p = participants.find((x) => x.id === target.id);
        onClose();
        if (p) a.setTransferPart(p);
        break;
      }
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Eltern melden sich …</DialogTitle>
          <DialogDescription>
            Halte hier fest, was die Eltern telefonisch oder per E-Mail mitgeteilt haben.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {childrenList.length > 1 && (
            <fieldset className="space-y-1">
              <legend className="text-xs text-muted-foreground">Um welches Kind geht es?</legend>
              {childrenList.map((c) => (
                <label key={c.key} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="parent-report-child"
                    checked={childKey === c.key}
                    onChange={() => {
                      setChildKey(c.key);
                      setTargetId("");
                    }}
                  />
                  <span>{c.name}</span>
                </label>
              ))}
            </fieldset>
          )}
          {child && (
            <fieldset className="space-y-2">
              <legend className="text-xs text-muted-foreground">
                Was haben die Eltern gemeldet?
              </legend>
              {CONCERNS.map((k) => {
                const n =
                  k === "sick" ? 1 : concernTargets(child.entries, child.bookings, k).length;
                return (
                  <label
                    key={k}
                    className={`flex items-start gap-2 ${n === 0 ? "text-muted-foreground" : ""}`}
                  >
                    <input
                      type="radio"
                      name="parent-report-concern"
                      className="mt-1"
                      disabled={n === 0}
                      checked={concern === k}
                      onChange={() => {
                        setConcern(k);
                        setTargetId("");
                      }}
                    />
                    <span>
                      {CONCERN_LABEL[k]}
                      {n === 0 && (
                        <span className="block text-xs">
                          Passt gerade nicht: Bei {child.name} gibt es dafür nichts Offenes.
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          )}

          {concern === "sick" && (
            <div className="rounded-md bg-amber-50 p-3 text-amber-950">
              <span className="font-semibold">Das passiert: </span>
              Nichts, hier wird keine Änderung gespeichert. Ein einzelner Ausfall wird pro Stunde
              vom Trainer in der Anwesenheit erfasst oder von den Eltern über den Abmelde-Link aus
              der Erinnerungsmail eingetragen. Der Kursplatz bleibt unverändert.
            </div>
          )}

          {target && (
            <>
              {targets.length > 1 && (
                <div className="space-y-1">
                  <label
                    htmlFor="parent-report-target"
                    className="block text-xs text-muted-foreground"
                  >
                    Welcher Eintrag?
                  </label>
                  <select
                    id="parent-report-target"
                    className="w-full rounded-md border bg-background p-2"
                    value={target.id}
                    onChange={(ev) => setTargetId(ev.target.value)}
                  >
                    {targets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="rounded-md bg-amber-50 p-3 text-amber-950">
                <span className="font-semibold">Das passiert: </span>
                {consequence(target.kind)}
              </div>
              {usesReason && (
                <div className="space-y-1">
                  <label
                    htmlFor="parent-report-reason"
                    className="block text-xs text-muted-foreground"
                  >
                    Grund{reasonRequired ? " (Pflicht)" : " (optional)"}
                  </label>
                  <Textarea
                    id="parent-report-reason"
                    value={reason}
                    onChange={(ev) => setReason(ev.target.value)}
                    placeholder="z. B. Eltern melden per Telefon: Kind bleibt bei der bisherigen Schwimmschule"
                    rows={3}
                    maxLength={500}
                  />
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {concern === "sick" ? "Schließen" : "Abbrechen"}
          </Button>
          {target && concern !== "sick" && (
            <Button disabled={busy || (reasonRequired && !trimmed)} onClick={run}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {CONFIRM_LABEL[target.kind]}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
