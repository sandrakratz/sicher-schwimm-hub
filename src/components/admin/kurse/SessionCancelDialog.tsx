import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateBerlin } from "@/lib/format";
import type { SessionRow } from "@/components/admin/kurse/SessionsDialog";

/** Fenster „Termin fällt aus“: Grund, Text an die Eltern (anpassbar), Trainer:innen informieren. */
export function SessionCancelDialog({
  courseName,
  session,
  busy,
  onClose,
  onConfirm,
}: {
  courseName: string;
  session: SessionRow;
  busy: boolean;
  onClose: () => void;
  onConfirm: (v: { reason: string; parentMessage: string; notifyTrainers: boolean }) => void;
}) {
  const when = `${formatDateBerlin(session.session_date)}${session.start_time ? ` um ${session.start_time.slice(0, 5)} Uhr` : ""}`;
  const [reason, setReason] = useState("");
  const [notifyParents, setNotifyParents] = useState(true);
  const [message, setMessage] = useState(
    `Liebe Eltern,\n\nder Termin von „${courseName}“ am ${when} fällt leider aus.\n\nViele Grüße\nSicher Schwimmen e.V.`,
  );
  const [notifyTrainers, setNotifyTrainers] = useState(true);
  const ok = reason.trim().length >= 3 && (!notifyParents || message.trim().length >= 5);

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Termin fällt aus: {when}</DialogTitle>
          <DialogDescription asChild>
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
              <span className="font-semibold">Das passiert: </span>
              Der Termin wird aus dem Plan genommen und verschwindet aus Dienstplan, Anwesenheit,
              Portal und Trainer-Kalender. Der Ausfall bleibt mit Grund unter „Ausgefallene Termine“
              festgehalten. Eingeteilte Trainer:innen verlieren den Einsatz. Ein Ersatztermin lässt
              sich danach mit „Termin hinzufügen“ anlegen.
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <label htmlFor="session-cancel-reason" className="text-xs text-muted-foreground">
              Grund (Pflicht, intern)
            </label>
            <Input
              id="session-cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="z. B. Bad wegen Wartung geschlossen"
              maxLength={500}
            />
          </div>
          <label className="flex items-center gap-2">
            <Checkbox checked={notifyParents} onCheckedChange={(v) => setNotifyParents(!!v)} />
            Eltern informieren (E-Mail und Handy-Mitteilung)
          </label>
          {notifyParents && (
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={4000}
              aria-label="Text an die Eltern"
            />
          )}
          <label className="flex items-center gap-2">
            <Checkbox checked={notifyTrainers} onCheckedChange={(v) => setNotifyTrainers(!!v)} />
            Eingeteilte Trainer:innen per E-Mail informieren
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          {!ok && (
            <span className="mr-auto text-xs text-muted-foreground">
              {reason.trim().length < 3
                ? "Bitte einen Grund eintragen."
                : "Text an die Eltern fehlt."}
            </span>
          )}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            disabled={busy || !ok}
            onClick={() =>
              onConfirm({
                reason: reason.trim(),
                parentMessage: notifyParents ? message.trim() : "",
                notifyTrainers,
              })
            }
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Termin fällt aus
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
