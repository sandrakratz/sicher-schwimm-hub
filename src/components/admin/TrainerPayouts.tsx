import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Printer, Trash2 } from "lucide-react";
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
import { formatDateBerlin, todayBerlinIso } from "@/lib/format";
import { formatEuro } from "@/lib/trainer-billing";
import { openCertificate } from "@/lib/trainer-certificate";
import {
  createManualPayout,
  deleteTrainerPayout,
  getBillingOverview,
  getPayoutCertificate,
  listTrainerPayouts,
  type PayoutListEntry,
} from "@/lib/trainer-billing.functions";

const selectCls =
  "h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Auszahlungen eines Jahres: nachtragen (bereits Überwiesenes), löschen, Jahresbescheinigung drucken. */
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
        },
      });
      toast.success("Auszahlung nachgetragen.");
      setManualAmount("");
      setManualNote("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Diese Auszahlung wirklich löschen?")) return;
    try {
      await deleteTrainerPayout({ data: { id } });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehlgeschlagen.");
    }
  }

  async function printCertificate() {
    if (!trainerId) {
      toast.error("Bitte zuerst eine Trainer:in auswählen.");
      return;
    }
    try {
      const cert = await getPayoutCertificate({ data: { year, trainerId } });
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
            Sie zählen für den Freibetrag-Stand und die Jahresbescheinigung mit. Wer die Termine
            einzeln nachweisen möchte, wählt stattdessen unter „Abrechnung“ die bestätigten Termine
            und trägt das damalige Überweisungsdatum ein.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-muted-foreground">
              Trainer:in
              <select
                className={`${selectCls} mt-1 block`}
                value={manualTrainer}
                onChange={(e) => setManualTrainer(e.target.value)}
              >
                <option value="">Bitte wählen</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
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
            <Button onClick={addManual}>Nachtragen</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          Jahr
          <select
            className={`${selectCls} mt-1 block`}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {Array.from({ length: thisYear - 2025 }, (_, i) => thisYear - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Trainer:in
          <select
            className={`${selectCls} mt-1 block`}
            value={trainerId}
            onChange={(e) => setTrainerId(e.target.value)}
          >
            <option value="">Alle</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" onClick={printCertificate}>
          <Printer className="mr-2 h-4 w-4" /> Jahresbescheinigung drucken
        </Button>
      </div>

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
                  <TableHead>Überwiesen am</TableHead>
                  <TableHead>Trainer:in</TableHead>
                  <TableHead>Inhalt</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead className="w-12" />
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
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label="Auszahlung löschen"
                        onClick={() => remove(p.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
