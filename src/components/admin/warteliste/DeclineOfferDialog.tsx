import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeclineReasonFields } from "@/components/admin/DeclineReasonFields";
import { combineReason } from "@/lib/decline-reasons";
import type { WaitlistEntry } from "./logic";

/**
 * „Absage erfassen“ zu einem offenen Platzangebot (Absage per Telefon/E-Mail).
 * Beim Wechsel des Eintrags mit neuem `key` rendern, dann starten die Felder leer.
 */
export function DeclineOfferDialog({
  entry,
  onClose,
  onSave,
  saving,
}: {
  entry: WaitlistEntry | null;
  onClose: () => void;
  onSave: (v: {
    entryId: string;
    stay: boolean;
    availableFrom: string | null;
    reason: string | null;
  }) => void;
  saving: boolean;
}) {
  const [stay, setStay] = useState(true);
  const [from, setFrom] = useState("");
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState("");

  return (
    <Dialog open={!!entry} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Absage erfassen – {entry?.child_name ?? ""}</DialogTitle>
          <DialogDescription>
            Der reservierte Platz wird freigegeben, die Absage zählt mit und der Platz geht an das
            nächste Kind. Es wird keine Rückfrage-Mail verschickt.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <label className="flex items-start gap-2">
            <input type="radio" checked={stay} onChange={() => setStay(true)} className="mt-1" />
            <span>Bleibt auf der Warteliste</span>
          </label>
          {stay && (
            <div className="ml-6 space-y-1">
              <label className="text-xs text-muted-foreground">
                Erst für Kurse ab (optional – sonst nächster Kurs nach dem Angebot)
              </label>
              <Input type="date" value={from} onChange={(ev) => setFrom(ev.target.value)} />
            </div>
          )}
          <label className="flex items-start gap-2">
            <input type="radio" checked={!stay} onChange={() => setStay(false)} className="mt-1" />
            <span>Möchte nicht mehr auf der Warteliste stehen</span>
          </label>
          <DeclineReasonFields
            category={category}
            detail={reason}
            onCategory={setCategory}
            onDetail={setReason}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            disabled={saving}
            onClick={() =>
              entry &&
              onSave({
                entryId: entry.id,
                stay,
                availableFrom: stay && from ? from : null,
                reason: combineReason(category, reason),
              })
            }
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Absage speichern
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
