import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  deleteCourseCost,
  getCourseResults,
  saveCourseCost,
  type CourseResult,
} from "@/lib/course-result.functions";

function parseAmount(v: string): number | null {
  const n = Number(v.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 && v.trim() !== "" ? n : null;
}

function resultOf(r: CourseResult) {
  const costs = r.costs.reduce((s, c) => s + c.amount, 0);
  const total = r.incomePaid - r.trainerCosts - costs;
  return { costs, total: Math.round(total * 100) / 100 };
}

function ResultAmount({ value }: { value: number }) {
  return (
    <span className={value < 0 ? "font-semibold text-destructive" : "font-semibold text-success"}>
      {formatEuro(value)}
    </span>
  );
}

/** Ergebnis je Kurs: Einnahmen − Übungsleitergelder − Wasserzeit/Sonstiges = Brutto-Ertrag. */
export function CourseResults() {
  const [results, setResults] = useState<CourseResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getCourseResults();
      setResults(res.results);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Kursergebnisse konnten nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return results.filter(
      (r) => (showAll || r.finished) && (!q || r.name.toLowerCase().includes(q)),
    );
  }, [results, showAll, search]);

  const sum = useMemo(() => shown.reduce((s, r) => s + resultOf(r).total, 0), [shown]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Pro Kurs: eingegangene Kursgebühren, ausgezahlte Übungsleitergelder und die Kosten für die
        Wasserzeit, die Sie hier selbst eintragen. Als „fertig“ gilt ein Kurs, wenn der letzte
        Kurstag vorbei ist und alle bestätigten Einsätze der Trainer:innen ausgezahlt sind. Zum
        Eintragen der Kosten die Zeile aufklappen.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          placeholder="Kurs suchen …"
          aria-label="Kurs suchen"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Auch Kurse zeigen, die noch laufen oder bei denen Auszahlungen offen sind
        </label>
        {shown.length > 0 && (
          <span className="ml-auto text-sm">
            Summe der angezeigten Kurse: <ResultAmount value={Math.round(sum * 100) / 100} />
          </span>
        )}
      </div>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Wird geladen …</div>
          ) : shown.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              Keine fertigen Kurse gefunden.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Kurs</TableHead>
                  <TableHead className="text-right">Einnahmen</TableHead>
                  <TableHead className="text-right">Übungsleiter</TableHead>
                  <TableHead className="text-right">Wasserzeit &amp; Sonstiges</TableHead>
                  <TableHead className="text-right">Ergebnis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r) => {
                  const { costs, total } = resultOf(r);
                  const open = openId === r.courseId;
                  return (
                    <Fragment key={r.courseId}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => setOpenId(open ? null : r.courseId)}
                      >
                        <TableCell>
                          {open ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.firstDate && formatDateBerlin(r.firstDate)} –{" "}
                            {r.lastDate && formatDateBerlin(r.lastDate)}
                            {!r.finished && (
                              <Badge variant="secondary" className="ml-2">
                                noch nicht fertig
                              </Badge>
                            )}
                            {r.costs.length === 0 && r.finished && (
                              <Badge variant="outline" className="ml-2">
                                Wasserzeit fehlt
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatEuro(r.incomePaid)}</TableCell>
                        <TableCell className="text-right">{formatEuro(r.trainerCosts)}</TableCell>
                        <TableCell className="text-right">{formatEuro(costs)}</TableCell>
                        <TableCell className="text-right">
                          <ResultAmount value={total} />
                        </TableCell>
                      </TableRow>
                      {open && (
                        <TableRow>
                          <TableCell />
                          <TableCell colSpan={5} className="bg-muted/30">
                            <CourseDetail result={r} total={total} onChanged={load} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CourseDetail({
  result: r,
  total,
  onChanged,
}: {
  result: CourseResult;
  total: number;
  onChanged: () => Promise<void>;
}) {
  const [label, setLabel] = useState("Wasserzeit");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(todayBerlinIso());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const value = parseAmount(amount);
    if (value === null) {
      toast.error("Bitte einen Betrag eingeben, z. B. 480,00.");
      return;
    }
    setBusy(true);
    try {
      await saveCourseCost({
        data: {
          courseId: r.courseId,
          label,
          amount: value,
          paidOn: paidOn || null,
          note: note || null,
        },
      });
      toast.success("Kosten gespeichert");
      setAmount("");
      setNote("");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern nicht möglich.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Diesen Kostenposten wirklich löschen?")) return;
    try {
      await deleteCourseCost({ data: { id } });
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Löschen nicht möglich.");
    }
  }

  const costSum = r.costs.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="grid gap-6 py-2 lg:grid-cols-2">
      <div className="space-y-3">
        <h3 className="font-semibold">Einnahmen</h3>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>Bezahlt ({r.paidCount} Anmeldungen)</dt>
            <dd>{formatEuro(r.incomePaid)}</dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>Noch offen ({r.openCount} Anmeldungen, nicht eingerechnet)</dt>
            <dd>{formatEuro(r.incomeOpen)}</dd>
          </div>
        </dl>
        <h3 className="pt-2 font-semibold">Übungsleitergelder</h3>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>Ausgezahlt</dt>
            <dd>− {formatEuro(r.trainerCosts)}</dd>
          </div>
          {r.unpaidSessions > 0 && (
            <div className="flex justify-between text-warning-foreground">
              <dt>Noch nicht ausgezahlt</dt>
              <dd>{r.unpaidSessions} Einsatz/Einsätze</dd>
            </div>
          )}
        </dl>
        <div className="flex justify-between border-t pt-2 text-base">
          <span className="font-semibold">Ergebnis (brutto)</span>
          <ResultAmount value={total} />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">Wasserzeit &amp; sonstige Kosten</h3>
        {r.costs.length > 0 && (
          <ul className="space-y-1 text-sm">
            {r.costs.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span>
                  {c.label}
                  {c.paidOn && (
                    <span className="text-muted-foreground"> · {formatDateBerlin(c.paidOn)}</span>
                  )}
                  {c.note && <span className="text-muted-foreground"> · {c.note}</span>}
                </span>
                <span className="flex items-center gap-1">
                  − {formatEuro(c.amount)}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    aria-label={`${c.label} löschen`}
                    onClick={() => void remove(c.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </li>
            ))}
            <li className="flex justify-between border-t pt-1 font-medium">
              <span>Summe</span>
              <span>− {formatEuro(costSum)}</span>
            </li>
          </ul>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            aria-label="Bezeichnung"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Bezeichnung"
          />
          <Input
            aria-label="Betrag in Euro"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Betrag in €, z. B. 480,00"
          />
          <Input
            aria-label="Datum"
            type="date"
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
          />
          <Input
            aria-label="Notiz"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notiz (optional)"
          />
        </div>
        <Button onClick={() => void add()} disabled={busy}>
          Kosten eintragen
        </Button>
      </div>
    </div>
  );
}
