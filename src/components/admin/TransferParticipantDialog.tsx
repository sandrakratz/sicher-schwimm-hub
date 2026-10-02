import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { previewTransfer, transferParticipant, type TransferPreview } from "@/lib/participant-transfer.functions";

type CourseOpt = { id: string; name: string; schedule?: string | null; location?: string | null; free?: number | null };

const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
const REASONS = [
  "Trainer-Empfehlung: Kind ist schon weiter",
  "Trainer-Empfehlung: Kind braucht mehr Wassergewöhnung",
  "Elternwunsch / Terminänderung",
];

export function TransferParticipantDialog({
  participant, courses, onClose, onDone,
}: {
  participant: { id: string; participant_name: string | null; participant_email: string | null; course_id: string } | null;
  courses: CourseOpt[];
  onClose: () => void;
  onDone: () => void;
}) {
  const previewFn = useServerFn(previewTransfer);
  const transferFn = useServerFn(transferParticipant);
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [pv, setPv] = useState<TransferPreview | null>(null);
  const [used, setUsed] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [override, setOverride] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTarget(""); setReason(""); setPv(null); setOverride(""); setNotify(true);
  }, [participant?.id]);

  useEffect(() => {
    if (!participant || !target) return;
    setPv(null);
    previewFn({ data: { participantId: participant.id, targetCourseId: target } })
      .then(r => { setPv(r); setUsed(r.oldUsed); setRemaining(r.newRemaining); setOverride(""); })
      .catch(e => toast.error((e as Error)?.message || "Berechnung fehlgeschlagen"));
  }, [participant?.id, target]);

  const calc = useMemo(() => {
    if (!pv) return null;
    const perOld = pv.oldTotal > 0 ? pv.oldPrice / pv.oldTotal : 0;
    const perNew = pv.newTotal > 0 ? pv.newPrice / pv.newTotal : 0;
    const usedValue = perOld * used;
    const credit = (pv.oldPaid ? pv.oldPrice : 0) - usedValue;
    const newCost = perNew * remaining;
    const due = Math.round((newCost - credit) * 100) / 100;
    return { perOld, perNew, usedValue, credit, newCost, due };
  }, [pv, used, remaining]);

  const finalDue = override.trim() !== "" ? Number(override.replace(",", ".")) : calc?.due ?? 0;

  async function submit() {
    if (!participant || !pv || !calc) return;
    if (reason.trim().length < 3) return toast.error("Bitte einen Grund angeben.");
    if (!Number.isFinite(finalDue)) return toast.error("Betrag ungültig.");
    setBusy(true);
    try {
      const calcNote = `alt ${eur(pv.oldPrice)}${pv.oldPaid ? " bezahlt" : " offen"}, ${used}/${pv.oldTotal} Termine genutzt; neu ${remaining}/${pv.newTotal} Termine à ${eur(calc.perNew)}${override.trim() ? `; Betrag manuell ${eur(finalDue)}` : ""}`;
      const r = await transferFn({ data: {
        participantId: participant.id, targetCourseId: target, reason: reason.trim(),
        amountDue: finalDue, calcNote, notify: notify && !!participant.participant_email,
      } });
      toast.success(["Umgebucht", r.emailed ? "E-Mail an die Eltern versendet" : null].filter(Boolean).join(" · "));
      onDone();
    } catch (e) {
      toast.error((e as Error)?.message || "Umbuchung fehlgeschlagen");
    } finally { setBusy(false); }
  }

  const options = courses.filter(c => c.id !== participant?.course_id);

  return (
    <Dialog open={!!participant} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Kind umbuchen: {participant?.participant_name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Neuer Kurs</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue placeholder="Kurs wählen …" /></SelectTrigger>
              <SelectContent>
                {options.map(c => (
                  <SelectItem key={c.id} value={c.id} disabled={c.free != null && c.free <= 0}>
                    {c.name}{c.schedule ? ` · ${c.schedule}` : ""}{c.free != null ? ` · ${c.free > 0 ? `${c.free} frei` : "voll"}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Grund der Umbuchung *</Label>
            <div className="mb-2 flex flex-wrap gap-1">
              {REASONS.map(r => (
                <Button key={r} type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReason(r)}>{r}</Button>
              ))}
            </div>
            <Textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} />
          </div>

          {target && !pv && <p className="text-sm text-muted-foreground">Wird berechnet …</p>}
          {pv && calc && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="font-semibold">Bisher: {pv.oldCourse}</div>
                  <div>Preis {eur(pv.oldPrice)} · {pv.oldPaid ? "bezahlt" : "nicht bezahlt"}</div>
                  <div>{pv.oldTotal} Termine → {eur(calc.perOld)} pro Termin</div>
                  <Label className="text-xs">Bereits genutzte Termine</Label>
                  <Input type="number" min={0} max={pv.oldTotal} value={used} onChange={e => setUsed(Math.max(0, Math.min(pv.oldTotal, Number(e.target.value) || 0)))} className="h-9 w-24" />
                  <div className="text-muted-foreground">Verbraucht: {eur(calc.usedValue)}</div>
                </div>
                <div className="space-y-1">
                  <div className="font-semibold">Neu: {pv.newCourse}</div>
                  <div>Preis {eur(pv.newPrice)} ({pv.isMember ? "Mitglied" : "Nicht-Mitglied"})</div>
                  <div>{pv.newTotal} Termine → {eur(calc.perNew)} pro Termin</div>
                  <Label className="text-xs">Noch anstehende Termine</Label>
                  <Input type="number" min={0} max={pv.newTotal} value={remaining} onChange={e => setRemaining(Math.max(0, Math.min(pv.newTotal, Number(e.target.value) || 0)))} className="h-9 w-24" />
                  <div className="text-muted-foreground">Kosten: {eur(calc.newCost)}</div>
                </div>
              </div>
              <div className="border-t pt-2">
                <div>Guthaben aus bisherigem Kurs: <strong>{eur(calc.credit)}</strong></div>
                <div className="text-base">
                  {calc.due > 0 ? <>Zuzahlung: <strong>{eur(calc.due)}</strong></>
                    : calc.due < 0 ? <>Guthaben / Erstattung: <strong>{eur(-calc.due)}</strong></>
                    : <strong>Kein Restbetrag – bleibt bezahlt</strong>}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Label className="text-xs">Betrag manuell (optional, negativ = Erstattung)</Label>
                  <Input value={override} onChange={e => setOverride(e.target.value)} placeholder={calc.due.toFixed(2)} className="h-8 w-28" />
                </div>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={notify} disabled={!participant?.participant_email} onCheckedChange={v => setNotify(!!v)} />
            Eltern per E-Mail informieren und um Zustimmung bitten (neue Termine{finalDue > 0 ? ", Restbetrag mit Bankverbindung" : ""}, Zustimmungs-Button)
          </label>
          <p className="text-xs text-muted-foreground">
            Die bisherige Buchung bleibt mit Anwesenheit als „Abgesagt (umgebucht)“ erhalten. Prüfungsfortschritt wird übernommen.
            Die Zustimmung der Eltern wird mit Zeitstempel gespeichert und in der Teilnehmerliste angezeigt.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button disabled={!pv || busy} onClick={submit}>{busy ? "Wird umgebucht …" : "Umbuchen"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
