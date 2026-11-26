import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Rückfrage vor einer Aktion mit Folgen (Bedienregel 5: „Das passiert“ statt Browser-confirm()).
 * Zeigt, was genau passiert und ob es sich rückgängig machen lässt; optional mit Grund-Feld.
 * Nur rendern, solange die Rückfrage offen ist – dann startet das Grund-Feld jedes Mal leer.
 */
export function ConfirmActionDialog({
  title,
  consequence,
  confirmLabel,
  onConfirm,
  onClose,
  busy = false,
  destructive = false,
  reason,
  option,
}: {
  title: string;
  /** Was nach dem Klick passiert (ganze Sätze, inkl. Mail ja/nein und Weg zurück). */
  consequence: ReactNode;
  confirmLabel: string;
  onConfirm: (reason: string, optionChecked: boolean) => void;
  onClose: () => void;
  busy?: boolean;
  destructive?: boolean;
  /** Grund-Feld anzeigen; `required` = Knopf erst mit Grund aktiv. */
  reason?: { label: string; placeholder?: string; required?: boolean };
  /** Zusätzliches Ankreuzfeld (z. B. „zusätzlich auf die Sperrliste“). */
  option?: { label: string };
}) {
  const [text, setText] = useState("");
  const [optionChecked, setOptionChecked] = useState(false);
  const trimmed = text.trim();
  const missing = !!reason?.required && !trimmed;

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
              <span className="font-semibold">Das passiert: </span>
              {consequence}
            </div>
          </DialogDescription>
        </DialogHeader>
        {reason && (
          <div className="space-y-1 text-sm">
            <label htmlFor="confirm-action-reason" className="block text-xs text-muted-foreground">
              {reason.label}
              {reason.required ? " (Pflicht)" : " (optional)"}
            </label>
            <Textarea
              id="confirm-action-reason"
              value={text}
              onChange={(ev) => setText(ev.target.value)}
              placeholder={reason.placeholder}
              rows={3}
              maxLength={500}
            />
          </div>
        )}
        {option && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={optionChecked}
              onChange={(ev) => setOptionChecked(ev.target.checked)}
            />
            <span>{option.label}</span>
          </label>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          {missing && (
            <span className="mr-auto text-xs text-muted-foreground">
              Bitte einen Grund eintragen.
            </span>
          )}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={busy || missing}
            onClick={() => onConfirm(trimmed, optionChecked)}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
