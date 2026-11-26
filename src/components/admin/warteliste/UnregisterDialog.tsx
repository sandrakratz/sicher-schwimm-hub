import { useState } from "react";
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
import type { WaitlistEntry } from "./logic";

/**
 * „Abmelden“ eines Wartelisten-Eintrags (Familie meldet sich selbst ab, z. B. bleibt bei einer
 * anderen Schwimmschule). Der Eintrag bleibt als „Entfernt“ erhalten, der Grund landet mit
 * Zeitstempel in der Notiz – über „Zurück auf wartend“ lässt er sich wieder aktivieren.
 * Beim Wechsel des Eintrags mit neuem `key` rendern, dann starten die Felder leer.
 */
export function UnregisterDialog({
  entry,
  onClose,
  onSave,
  saving,
}: {
  entry: WaitlistEntry | null;
  onClose: () => void;
  onSave: (v: { reason: string; blocklist: boolean }) => void;
  saving: boolean;
}) {
  const [reason, setReason] = useState("");
  const [blocklist, setBlocklist] = useState(false);
  const trimmed = reason.trim();

  return (
    <Dialog open={!!entry} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Abmelden – {entry?.child_name ?? ""}</DialogTitle>
          <DialogDescription>
            Der Eintrag bleibt als „Entfernt“ erhalten, der Grund wird mit Datum in der Notiz
            festgehalten. Es wird keine E-Mail verschickt. Meldet sich die Familie wieder, holt
            „Zurück auf wartend“ den Eintrag zurück.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <label htmlFor="unregister-reason" className="block text-xs text-muted-foreground">
              Grund (Pflicht)
            </label>
            <Textarea
              id="unregister-reason"
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
              placeholder="z. B. Eltern melden per Telefon: Kind bleibt bei der bisherigen Schwimmschule"
              rows={3}
              maxLength={500}
            />
          </div>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={blocklist}
              onChange={(ev) => setBlocklist(ev.target.checked)}
              className="mt-1"
            />
            <span>Zusätzlich auf die Sperrliste setzen (nur bei Problemen mit der Familie)</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            disabled={saving || !trimmed}
            onClick={() => onSave({ reason: trimmed, blocklist })}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Abmelden
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
