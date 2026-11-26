import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileText, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateBerlin, formatEuro, todayBerlinIso } from "@/lib/format";
import { openCertificate, openReceipt } from "@/lib/trainer-certificate";
import {
  approveTrainerPayout,
  createManualPayout,
  deleteTrainerPayout,
  getPayoutReceipt,
  getBillingOverview,
  getPayoutCertificate,
  listTrainerPayouts,
  requestPayoutCancellation,
  withdrawPayoutCancellation,
  type PayoutListEntry,
} from "@/lib/trainer-billing.functions";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * Auszahlungen eines Jahres: freigeben (zweite Person), Beleg drucken, nachtragen, löschen,
 * Jahresbescheinigung drucken.
 */
export function TrainerPayouts() {
  const thisYear = Number(todayBerlinIso().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [trainerId, setTrainerId] = useState("");
  const [payouts, setPayouts] = useState<PayoutListEntry[]>([]);
  const [trainers, setTrainers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualTrainer, setManualTrainer] = useState("");
  const [manualDate, setManualDate] = useState(todayBerlinIso());
  const [manualAmount, setManualAmount] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTrainerPayouts({
        data: { year, trainerId: trainerId || undefined },
      });
      setPayouts(res.payouts);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Auszahlungen konnten nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }, [year, trainerId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    // Nur die Trainer:innen-Liste wird gebraucht; ein Datum in der Zukunft liefert keine Einsätze.
    getBillingOverview({ data: { from: "2999-01-01" } })
      .then((res) => setTrainers(res.trainers))
      .catch(() => undefined);
  }, []);

  const total = payouts.reduce((s, p) => s + p.total, 0);

  async function addManual() {
    const amount = Number(manualAmount.replace(",", "."));
    if (!manualTrainer || !Number.isFinite(amount) || amount <= 0 || !manualDate) {
      toast.error("Bitte Trainer:in, Datum und einen Betrag größer 0 angeben.");
      return;
    }
    try {
      await createManualPayout({
        data: {
          trainerId: manualTrainer,
          paidOn: manualDate,
          amount,
          note: manualNote || undefined,
          overrideReason: manualReason.trim() || undefined,
        },
      });
      toast.success("Auszahlung nachgetragen – wartet auf Freigabe.");
      setManualAmount("");
      setManualNote("");
      setManualReason("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  // Entfernen: nicht freigegeben = löschen; freigegeben = Stornierung zu zweit (beantragen, bestätigen)
  const [action, setAction] = useState<{
    kind: "delete" | "request" | "confirm";
    p: PayoutListEntry;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function runPending(reason: string) {
    if (!action) return;
    const { kind, p } = action;
    setBusy(true);
    try {
      if (kind === "request") {
        await requestPayoutCancellation({ data: { id: p.id, reason } });
        toast.success("Stornierung beantragt – eine zweite Person muss bestätigen.");
      } else {
        await deleteTrainerPayout({ data: { id: p.id } });
        toast.success(
          kind === "delete"
            ? `Auszahlung an ${p.trainerName} gelöscht – die Termine sind wieder offen.`
            : `Auszahlung an ${p.trainerName} storniert – die Termine sind wieder offen.`,
        );
      }
      setAction(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function withdrawCancel(p: PayoutListEntry, mine: boolean) {
    try {
      await withdrawPayoutCancellation({ data: { id: p.id } });
      toast.success(
        mine ? "Antrag zurückgezogen." : "Stornierung abgelehnt – die Auszahlung bleibt.",
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehlgeschlagen.");
    }
  }

  async function approve(p: PayoutListEntry) {
    try {
      await approveTrainerPayout({ data: { id: p.id } });
      toast.success(`Freigegeben: ${p.trainerName}, ${formatEuro(p.total)}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Freigabe fehlgeschlagen.");
    }
  }

  async function printReceipt(id: string) {
    try {
      const r = await getPayoutReceipt({ data: { id } });
      if (!openReceipt(r)) toast.error("Bitte Pop-ups für diese Seite erlauben.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Beleg konnte nicht erstellt werden.");
    }
  }

  const pending = payouts.filter((p) => p.status === "pending");

  async function printCertificate() {
    if (!trainerId) {
      toast.error("Bitte zuerst eine Trainer:in auswählen.");
      return;
    }
    try {
      const cert = await getPayoutCertificate({ data: { year, trainerId } });
      if (
        cert.pendingCount > 0 &&
        !window.confirm(
          `${cert.pendingCount} Auszahlung(en) sind noch nicht freigegeben und stehen nicht auf der Bescheinigung. Trotzdem drucken?`,
        )
      )
        return;
      if (!openCertificate(cert)) toast.error("Bitte Pop-ups für diese Seite erlauben.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Bescheinigung konnte nicht erstellt werden.",
      );
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-soft">
        <CardContent className="space-y-3 p-4">
          <div className="font-medium">Bereits überwiesenes nachtragen</div>
          <p className="text-sm text-muted-foreground">
            Für Beträge, die schon vor dem Portal ausgezahlt wurden (z. B. die ersten Monate 2026).
            Sie zählen für den Freibetrag-Stand mit und stehen nach der Freigabe auf der
            Jahresbescheinigung. Wer die Termine einzeln nachweisen möchte, wählt stattdessen unter
            „Abrechnung“ die bestätigten Termine und trägt das damalige Überweisungsdatum ein.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-muted-foreground">
              Trainer:in
              <NativeSelect
                size="lg"
                className="mt-1 block"
                value={manualTrainer}
                onChange={(e) => setManualTrainer(e.target.value)}
              >
                <option value="">Bitte wählen</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-xs text-muted-foreground">
              Überwiesen am
              <Input
                type="date"
                className="mt-1 w-40"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Betrag (€)
              <Input
                inputMode="decimal"
                className="mt-1 w-32"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="z. B. 240,00"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Hinweis (optional)
              <Input
                className="mt-1 w-56"
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="z. B. Januar–März 2026"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Begründung (nur bei Grenze/fehlender Erklärung)
              <Input
                className="mt-1 w-64"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
              />
            </label>
            <Button onClick={addManual}>Nachtragen</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          Jahr
          <NativeSelect
            size="lg"
            className="mt-1 block"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {Array.from({ length: thisYear - 2025 }, (_, i) => thisYear - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="text-xs text-muted-foreground">
          Trainer:in
          <NativeSelect
            size="lg"
            className="mt-1 block"
            value={trainerId}
            onChange={(e) => setTrainerId(e.target.value)}
          >
            <option value="">Alle</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button
          variant="outline"
          disabled={!trainerId}
          title={trainerId ? undefined : "Erst eine Trainer:in auswählen"}
          onClick={printCertificate}
        >
          <Printer className="mr-2 h-4 w-4" /> Jahresbescheinigung drucken
        </Button>
        {!trainerId && (
          <span className="self-center text-xs text-muted-foreground">
            Erst eine Trainer:in auswählen.
          </span>
        )}
      </div>

      {pending.length > 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {pending.length} Auszahlung(en) warten auf Freigabe. Freigeben kann nur, wer sie nicht
          angelegt hat und sie nicht selbst bekommt.
        </p>
      )}

      <Card className="border-0 shadow-soft">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Wird geladen …</div>
          ) : payouts.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              Keine Auszahlungen in {year}.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Auszahlung am</TableHead>
                  <TableHead>Trainer:in</TableHead>
                  <TableHead>Inhalt</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDateBerlin(p.paidOn)}</TableCell>
                    <TableCell className="font-medium">{p.trainerName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.itemCount > 0 ? `${p.itemCount} Termine` : (p.note ?? "Nachgetragen")}
                    </TableCell>
                    <TableCell className="text-right">{formatEuro(p.total)}</TableCell>
                    <TableCell className="text-sm">
                      {p.status === "approved" ? (
                        <span className="flex items-center gap-1 text-success">
                          <CheckCircle2 className="h-4 w-4" />
                          {p.approvedByName
                            ? `frei: ${p.approvedByName}${p.approvedAt ? `, ${formatDateBerlin(p.approvedAt)}` : ""}`
                            : "freigegeben"}
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <Badge variant="secondary" className="bg-amber-100 text-amber-900">
                            zur Freigabe
                          </Badge>
                          {p.createdByName && (
                            <div className="text-xs text-muted-foreground">
                              angelegt: {p.createdByName}
                            </div>
                          )}
                          {p.createdBy !== me && p.trainerId !== me ? (
                            <Button size="sm" onClick={() => void approve(p)}>
                              Freigeben
                            </Button>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              {p.trainerId === me
                                ? "eigene Auszahlung – gibt jemand anderes frei"
                                : "von dir angelegt – gibt jemand anderes frei"}
                            </div>
                          )}
                        </div>
                      )}
                      {p.overrideReason && (
                        <div className="mt-1 text-xs text-amber-700" title={p.overrideReason}>
                          ⚠ mit Begründung
                        </div>
                      )}
                      {p.cancelRequest && (
                        <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
                          Storno beantragt: {p.cancelRequest.byName ?? "Vorstand"},{" "}
                          {formatDateBerlin(p.cancelRequest.at)}
                          {p.cancelRequest.reason ? ` – „${p.cancelRequest.reason}“` : ""}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          aria-label="Beleg drucken"
                          title="Beleg drucken"
                          onClick={() => void printReceipt(p.id)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        {p.status === "pending" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setAction({ kind: "delete", p })}
                          >
                            Löschen …
                          </Button>
                        ) : !p.cancelRequest ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setAction({ kind: "request", p })}
                          >
                            Stornieren …
                          </Button>
                        ) : p.cancelRequest.byId === me ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void withdrawCancel(p, true)}
                          >
                            Antrag zurückziehen
                          </Button>
                        ) : p.trainerId === me ? (
                          <span className="text-xs text-muted-foreground">
                            eigene Auszahlung – bestätigt jemand anderes
                          </span>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setAction({ kind: "confirm", p })}
                            >
                              Storno bestätigen …
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void withdrawCancel(p, false)}
                            >
                              Ablehnen
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} className="font-semibold">
                    Summe {year}
                    {trainerId ? "" : " (alle)"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatEuro(total)}</TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {action && (
        <ConfirmActionDialog
          title={
            action.kind === "delete"
              ? `Auszahlung an ${action.p.trainerName} löschen`
              : action.kind === "request"
                ? `Stornierung beantragen: ${action.p.trainerName}, ${formatEuro(action.p.total)}`
                : `Stornierung bestätigen: ${action.p.trainerName}, ${formatEuro(action.p.total)}`
          }
          consequence={
            action.kind === "delete" ? (
              <>
                Die Auszahlung ist noch nicht freigegeben. Sie wird gelöscht, die Termine sind
                danach wieder offen und lassen sich neu abrechnen. Der Vorgang steht im
                Änderungsprotokoll.
              </>
            ) : action.kind === "request" ? (
              <>
                Die Auszahlung ist freigegeben und bleibt es vorerst. Eine zweite Person aus dem
                Vorstand muss die Stornierung bestätigen. Erst dann wird sie entfernt und die
                Termine sind wieder offen. Eine Überweisung oder Buchung in MeinVerein ändert sich
                dadurch nicht.
              </>
            ) : (
              <>
                Beantragt von {action.p.cancelRequest?.byName ?? "Vorstand"}
                {action.p.cancelRequest?.reason
                  ? `, Grund: „${action.p.cancelRequest.reason}“`
                  : ""}
                . Die Auszahlung wird entfernt, die Termine sind wieder offen. Sie fehlt danach auf
                Beleg und Jahresbescheinigung. Eine Überweisung oder Buchung in MeinVerein bitte
                dort selbst korrigieren. Antrag und Bestätigung stehen im Änderungsprotokoll.
              </>
            )
          }
          reason={
            action.kind === "request"
              ? {
                  label: "Grund",
                  placeholder: "z. B. Fehlbuchung, falscher Betrag",
                  required: true,
                }
              : undefined
          }
          confirmLabel={
            action.kind === "delete"
              ? "Löschen"
              : action.kind === "request"
                ? "Stornierung beantragen"
                : "Stornierung bestätigen"
          }
          destructive={action.kind !== "request"}
          busy={busy}
          onClose={() => setAction(null)}
          onConfirm={(r) => void runPending(r)}
        />
      )}
    </div>
  );
}
