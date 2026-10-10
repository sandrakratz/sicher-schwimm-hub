import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DeclineReasonFields } from "@/components/admin/DeclineReasonFields";
import { Hint, type Participant } from "@/components/admin/kurse/shared";

/** Absage eines Teilnehmers erfassen (Grund für den Absagen-Zähler). */
export function CancelParticipantDialog({
  participant,
  busy,
  category,
  detail,
  onCategory,
  onDetail,
  onClose,
  onConfirm,
}: {
  participant: Participant | null;
  busy: boolean;
  category: string;
  detail: string;
  onCategory: (v: string) => void;
  onDetail: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!participant} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Absage erfassen – {participant?.participant_name ?? "Kind"}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Der Platz wird frei und an die Anfrageliste vergeben. Die Absage zählt für den
          Absagen-Zähler und den Sperrvorschlag.
        </p>
        <DeclineReasonFields
          category={category}
          detail={detail}
          onCategory={onCategory}
          onDetail={onDetail}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose()} disabled={busy}>
            Abbrechen
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {busy ? "Speichern…" : "Absage speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type RemoveState = {
  participant: Participant;
  reason: string;
  blocklist: boolean;
  notify: "unpaid" | "agreed" | "none";
  note: string;
};

/** Teilnehmer aus dem Kurs entfernen (Grund, E-Mail an die Eltern, Sperrliste). */
export function RemoveParticipantDialog({
  state,
  setState,
  removing,
  onConfirm,
}: {
  state: RemoveState | null;
  setState: Dispatch<SetStateAction<RemoveState | null>>;
  removing: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!state} onOpenChange={(v) => !v && setState(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Teilnehmer entfernen</DialogTitle>
        </DialogHeader>
        {state && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              „{state.participant.participant_name}“ wird aus dem Kurs entfernt.
              {!state.participant.paid && " Die Zahlung ist bisher nicht eingegangen."}
            </p>
            <div className="space-y-1">
              <Label>Grund</Label>
              <Select
                value={
                  ["Nichtzahlung", "Rücktritt der Eltern", "Sonstiges"].includes(state.reason)
                    ? state.reason
                    : "Sonstiges"
                }
                onValueChange={(v) =>
                  setState(
                    (s) =>
                      s && {
                        ...s,
                        reason: v === "Sonstiges" ? "" : v,
                        blocklist: v === "Nichtzahlung" ? true : s.blocklist,
                        notify: v === "Nichtzahlung" ? "unpaid" : s.notify,
                      },
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Grund wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Nichtzahlung">Nichtzahlung</SelectItem>
                  <SelectItem value="Rücktritt der Eltern">Rücktritt der Eltern</SelectItem>
                  <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                value={state.reason}
                onChange={(e) => setState((s) => s && { ...s, reason: e.target.value })}
                placeholder="Notiz zum Grund (optional)"
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label>E-Mail an die Eltern</Label>
              <Select
                value={state.participant.participant_email ? state.notify : "none"}
                disabled={!state.participant.participant_email}
                onValueChange={(v) =>
                  setState(
                    (s) =>
                      s && {
                        ...s,
                        notify: v as "unpaid" | "agreed" | "none",
                        blocklist: v === "unpaid" ? true : s.blocklist,
                      },
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">
                    Platz freigegeben (keine Rückmeldung/Zahlung)
                  </SelectItem>
                  <SelectItem value="agreed">Abmeldung wie besprochen (z. B. Krankheit)</SelectItem>
                  <SelectItem value="none">Keine E-Mail senden</SelectItem>
                </SelectContent>
              </Select>
              <Hint>
                {!state.participant.participant_email
                  ? "Keine E-Mail-Adresse hinterlegt – es kann keine E-Mail versendet werden."
                  : state.notify === "none"
                    ? "Es wird keine E-Mail versendet."
                    : `Empfänger: ${state.participant.participant_email}`}
              </Hint>
              {state.notify !== "none" && !!state.participant.participant_email && (
                <Textarea
                  value={state.note}
                  onChange={(e) => setState((s) => s && { ...s, note: e.target.value })}
                  placeholder="Persönliche Ergänzung für die E-Mail (optional)"
                  rows={3}
                />
              )}
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={state.blocklist}
                onCheckedChange={(v) => setState((s) => s && { ...s, blocklist: !!v })}
              />
              <span>
                Auf die Sperrliste setzen
                <span className="block text-xs text-muted-foreground">
                  Zukünftige Buchungen und Wartelisteneinträge werden blockiert (jederzeit unter
                  „Sperrliste“ rücknehmbar).
                </span>
              </span>
            </label>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setState(null)}>
            Abbrechen
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={removing}>
            {removing ? "Wird entfernt…" : "Entfernen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
