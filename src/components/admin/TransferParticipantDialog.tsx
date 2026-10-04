import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  previewTransfer,
  returnParticipantToWaitlist,
  transferParticipant,
  type TransferPreview,
} from "@/lib/participant-transfer.functions";
import { cancellationFeeRule } from "@/lib/billing-config";
import { formatDateBerlin } from "@/lib/format";

type CourseOpt = {
  id: string;
  name: string;
  schedule?: string | null;
  location?: string | null;
  free?: number | null;
};

type Mode = "course" | "waitlist";

const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
const round2 = (n: number) => Math.round(n * 100) / 100;
const REASONS = [
  "Trainer-Empfehlung: Kind ist schon weiter",
  "Trainer-Empfehlung: Kind braucht mehr Wassergewöhnung",
  "Elternwunsch / Terminänderung",
];

export function TransferParticipantDialog({
  participant,
  courses,
  onClose,
  onDone,
}: {
  participant: {
    id: string;
    participant_name: string | null;
    participant_email: string | null;
    course_id: string;
  } | null;
  courses: CourseOpt[];
  onClose: () => void;
  onDone: () => void;
}) {
  const previewFn = useServerFn(previewTransfer);
  const transferFn = useServerFn(transferParticipant);
  const waitlistFn = useServerFn(returnParticipantToWaitlist);
  const [mode, setMode] = useState<Mode>("course");
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [pv, setPv] = useState<TransferPreview | null>(null);
  const [used, setUsed] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [fee, setFee] = useState("");
  const [override, setOverride] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode("course");
    setTarget("");
    setReason("");
    setPv(null);
    setFee("");
    setOverride("");
    setNotify(true);
  }, [participant?.id]);

  useEffect(() => {
    if (!participant || (mode === "course" && !target)) return;
    setPv(null);
    previewFn({
      data: {
        participantId: participant.id,
        targetCourseId: mode === "course" ? target : undefined,
      },
    })
      .then((r) => {
        setPv(r);
        setUsed(r.oldUsed);
        setRemaining(r.newRemaining);
        setOverride("");
      })
      .catch((e) => toast.error((e as Error)?.message || "Berechnung fehlgeschlagen"));
  }, [participant?.id, target, mode]);

  const feeNum = Math.max(0, Number(fee.replace(",", ".")) || 0);

  const calc = useMemo(() => {
    if (!pv) return null;
    const perOld = pv.oldTotal > 0 ? pv.oldPrice / pv.oldTotal : 0;
    const perNew = pv.newTotal > 0 ? pv.newPrice / pv.newTotal : 0;
    const usedValue = perOld * used;
    const credit = (pv.oldPaid ? pv.oldPrice : 0) - usedValue;
    const newCost = mode === "course" ? perNew * remaining : 0;
    const due = round2(newCost - credit + feeNum);
    const rule = cancellationFeeRule(pv.daysBeforeStart);
    // Gebühr nach § 3 vom Preis des bisherigen Kurses; bereits genutzte Termine werden nicht doppelt berechnet
    const suggestedFee = round2(Math.max(0, (pv.oldPrice * rule.pct) / 100 - usedValue));
    return { perOld, perNew, usedValue, credit, newCost, due, rule, suggestedFee };
  }, [pv, used, remaining, feeNum, mode]);

  const finalDue = override.trim() !== "" ? Number(override.replace(",", ".")) : (calc?.due ?? 0);

  async function submit() {
    if (!participant || !pv || !calc) return;
    if (reason.trim().length < 3) return toast.error("Bitte einen Grund angeben.");
    if (!Number.isFinite(finalDue)) return toast.error("Betrag ungültig.");
    setBusy(true);
    try {
      const oldNote = `alt ${eur(pv.oldPrice)}${pv.oldPaid ? " bezahlt" : " offen"}, ${used}/${pv.oldTotal} Termine genutzt`;
      const manualNote = override.trim() ? `; Betrag manuell ${eur(finalDue)}` : "";
      const canNotify = notify && !!participant.participant_email;
      if (mode === "waitlist") {
        const r = await waitlistFn({
          data: {
            participantId: participant.id,
            reason: reason.trim(),
            amountDue: finalDue,
            cancellationFee: feeNum,
            calcNote: `${oldNote}${manualNote}`,
            notify: canNotify,
          },
        });
        toast.success(
          ["Zurück auf die Warteliste gesetzt", r.emailed ? "E-Mail an die Eltern versendet" : null]
            .filter(Boolean)
            .join(" · "),
        );
      } else {
        const r = await transferFn({
          data: {
            participantId: participant.id,
            targetCourseId: target,
            reason: reason.trim(),
            amountDue: finalDue,
            cancellationFee: feeNum,
            calcNote: `${oldNote}; neu ${remaining}/${pv.newTotal} Termine à ${eur(calc.perNew)}${manualNote}`,
            notify: canNotify,
          },
        });
        toast.success(
          ["Umgebucht", r.emailed ? "E-Mail an die Eltern versendet" : null]
            .filter(Boolean)
            .join(" · "),
        );
      }
      onDone();
    } catch (e) {
      toast.error((e as Error)?.message || "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  const options = courses.filter((c) => c.id !== participant?.course_id);
  const waitlist = mode === "waitlist";

  return (
    <Dialog open={!!participant} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {waitlist ? "Kurs verschoben – zurück auf die Warteliste" : "Kind umbuchen"}:{" "}
            {participant?.participant_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={waitlist ? "outline" : "default"}
              onClick={() => setMode("course")}
            >
              In anderen Kurs umbuchen
            </Button>
            <Button
              type="button"
              size="sm"
              variant={waitlist ? "default" : "outline"}
              onClick={() => setMode("waitlist")}
            >
              Zurück auf die Warteliste
            </Button>
          </div>
          {!waitlist && (
            <div>
              <Label>Neuer Kurs</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger>
                  <SelectValue placeholder="Kurs wählen …" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((c) => (
                    <SelectItem key={c.id} value={c.id} disabled={c.free != null && c.free <= 0}>
                      {c.name}
                      {c.schedule ? ` · ${c.schedule}` : ""}
                      {c.free != null ? ` · ${c.free > 0 ? `${c.free} frei` : "voll"}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>{waitlist ? "Grund der Verschiebung *" : "Grund der Umbuchung *"}</Label>
            <div className="mb-2 flex flex-wrap gap-1">
              {REASONS.map((r) => (
                <Button
                  key={r}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setReason(r)}
                >
                  {r}
                </Button>
              ))}
            </div>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>

          {!pv && (waitlist || target) && (
            <p className="text-sm text-muted-foreground">Wird berechnet …</p>
          )}
          {pv && calc && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="font-semibold">Bisher: {pv.oldCourse}</div>
                  <div>
                    Preis {eur(pv.oldPrice)} · {pv.oldPaid ? "bezahlt" : "nicht bezahlt"}
                  </div>
                  <div>
                    {pv.oldTotal} Termine → {eur(calc.perOld)} pro Termin
                  </div>
                  <Label className="text-xs">Bereits genutzte Termine</Label>
                  <Input
                    type="number"
                    min={0}
                    max={pv.oldTotal}
                    value={used}
                    onChange={(e) =>
                      setUsed(Math.max(0, Math.min(pv.oldTotal, Number(e.target.value) || 0)))
                    }
                    className="h-9 w-24"
                  />
                  <div className="text-muted-foreground">Verbraucht: {eur(calc.usedValue)}</div>
                </div>
                {waitlist ? (
                  <div className="space-y-1">
                    <div className="font-semibold">Neu: Warteliste</div>
                    <div className="text-muted-foreground">
                      Der Kursplatz wird frei. Die Familie wartet frühestens auf einen Kurs, der
                      nach dem Start von „{pv.oldCourse}“ beginnt, und bekommt dann automatisch ein
                      Platzangebot.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="font-semibold">Neu: {pv.newCourse}</div>
                    <div>
                      Preis {eur(pv.newPrice)} ({pv.isMember ? "Mitglied" : "Nicht-Mitglied"})
                    </div>
                    <div>
                      {pv.newTotal} Termine → {eur(calc.perNew)} pro Termin
                    </div>
                    <Label className="text-xs">Noch anstehende Termine</Label>
                    <Input
                      type="number"
                      min={0}
                      max={pv.newTotal}
                      value={remaining}
                      onChange={(e) =>
                        setRemaining(
                          Math.max(0, Math.min(pv.newTotal, Number(e.target.value) || 0)),
                        )
                      }
                      className="h-9 w-24"
                    />
                    <div className="text-muted-foreground">Kosten: {eur(calc.newCost)}</div>
                  </div>
                )}
              </div>

              <div className="space-y-1 border-t pt-2">
                <Label>Stornogebühr (§ 3 Kursteilnahmebedingungen)</Label>
                <div className="text-xs text-muted-foreground">
                  {pv.oldStartsOn
                    ? `„${pv.oldCourse}“ beginnt am ${formatDateBerlin(pv.oldStartsOn)} (${
                        pv.daysBeforeStart != null && pv.daysBeforeStart >= 0
                          ? `in ${pv.daysBeforeStart} ${pv.daysBeforeStart === 1 ? "Tag" : "Tagen"}`
                          : "bereits gestartet"
                      }) → ${calc.rule.label}${calc.rule.pct > 0 ? `: ${calc.rule.pct} %` : ""}. `
                    : "Kursbeginn unbekannt. "}
                  Bei Trainer-Empfehlung keine Stornogebühr berechnen.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    placeholder="0,00"
                    className="h-8 w-28"
                  />
                  <span className="text-xs">€</span>
                  {calc.suggestedFee > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setFee(calc.suggestedFee.toFixed(2).replace(".", ","))}
                    >
                      Vorschlag übernehmen: {eur(calc.suggestedFee)}
                      {calc.usedValue > 0 ? " (abzgl. genutzter Termine)" : ""}
                    </Button>
                  )}
                </div>
              </div>

              <div className="border-t pt-2">
                <div>
                  Guthaben aus bisherigem Kurs: <strong>{eur(calc.credit)}</strong>
                  {feeNum > 0 && (
                    <>
                      {" "}
                      · Stornogebühr: <strong>{eur(feeNum)}</strong>
                    </>
                  )}
                </div>
                <div className="text-base">
                  {calc.due > 0 ? (
                    <>
                      {waitlist ? "Noch zu zahlen" : "Zuzahlung"}: <strong>{eur(calc.due)}</strong>
                    </>
                  ) : calc.due < 0 ? (
                    <>
                      Guthaben{waitlist ? " für den nächsten Kurs" : " / Erstattung"}:{" "}
                      <strong>{eur(-calc.due)}</strong>
                    </>
                  ) : (
                    <strong>
                      {waitlist ? "Kein Betrag offen" : "Kein Restbetrag – bleibt bezahlt"}
                    </strong>
                  )}
                </div>
                {waitlist && calc.due > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Ein offener Betrag wird per E-Mail angefordert, aber nicht automatisch
                    nachverfolgt.
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <Label className="text-xs">Betrag manuell (optional, negativ = Erstattung)</Label>
                  <Input
                    value={override}
                    onChange={(e) => setOverride(e.target.value)}
                    placeholder={calc.due.toFixed(2)}
                    className="h-8 w-28"
                  />
                </div>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={notify}
              disabled={!participant?.participant_email}
              onCheckedChange={(v) => setNotify(!!v)}
            />
            {waitlist
              ? `Eltern per E-Mail informieren (Wartelisten-Platz${feeNum > 0 ? ", Stornogebühr" : ""}${finalDue > 0 ? ", Bankverbindung" : ""})`
              : `Eltern per E-Mail informieren und um Zustimmung bitten (neue Termine${feeNum > 0 ? ", Stornogebühr" : ""}${finalDue > 0 ? ", Restbetrag mit Bankverbindung" : ""}, Zustimmungs-Button)`}
          </label>
          <p className="text-xs text-muted-foreground">
            {waitlist
              ? "Die bisherige Buchung bleibt mit Anwesenheit als „Abgesagt“ erhalten, Stornogebühr und Guthaben stehen in den internen Notizen. Das Kind erscheint wieder auf der Warteliste."
              : "Die bisherige Buchung bleibt mit Anwesenheit als „Abgesagt (umgebucht)“ erhalten. Prüfungsfortschritt wird übernommen. Die Zustimmung der Eltern wird mit Zeitstempel gespeichert und in der Teilnehmerliste angezeigt."}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button disabled={!pv || busy} onClick={submit}>
            {busy ? "Wird gespeichert …" : waitlist ? "Auf Warteliste setzen" : "Umbuchen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
