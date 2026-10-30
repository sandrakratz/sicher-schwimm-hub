import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, ChevronRight, Download, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateBerlin, todayBerlinIso } from "@/lib/format";
import { ANNUAL_ALLOWANCE, WARN_FRACTION, formatEuro } from "@/lib/trainer-billing";
import {
  createTrainerPayout,
  deleteTrainerPayout,
  deleteTrainerRate,
  getBillingOverview,
  saveTrainerRate,
  setProgramBilledHours,
  type BillingOverview,
  type BillingRow,
} from "@/lib/trainer-billing.functions";

const selectCls =
  "h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function csvCell(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

function timeText(r: { startTime: string | null; endTime: string | null }) {
  if (!r.startTime) return "";
  const a = r.startTime.slice(0, 5);
  return r.endTime ? `${a}–${r.endTime.slice(0, 5)}` : a;
}

/** Warum ein bestätigter Einsatz (noch) nicht ausgezahlt werden kann. */
function blocker(r: BillingRow): string | null {
  if (r.paid) return null;
  if (!r.assigned) return "nicht zugeteilt";
  if (r.hours === null) return "Stunden fehlen";
  if (r.rate === null) return "Satz fehlt";
  return null;
}

export function TrainerBilling() {
  const today = todayBerlinIso();
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const [courseId, setCourseId] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [data, setData] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paidOn, setPaidOn] = useState(today);
  const [busy, setBusy] = useState(false);
  const [openPayouts, setOpenPayouts] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBillingOverview({
        data: { from: from || undefined, to: to || undefined, courseId: courseId || undefined },
      });
      setData(res);
      setSelected(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Abrechnung konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [from, to, courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(
    () => (data?.rows ?? []).filter((r) => !trainerId || r.trainerId === trainerId),
    [data, trainerId],
  );
  const key = (r: BillingRow) => `${r.trainerId}:${r.sessionId}`;

  const openRows = useMemo(() => rows.filter((r) => !r.paid), [rows]);
  /** Ausgezahlte Termine, je Überweisung zusammengefasst (neueste zuerst). */
  const payoutGroups = useMemo(() => {
    const groups = new Map<
      string,
      { id: string; trainerName: string; paidOn: string; total: number; rows: BillingRow[] }
    >();
    for (const r of rows) {
      if (!r.paid) continue;
      const g = groups.get(r.paid.payoutId) ?? {
        id: r.paid.payoutId,
        trainerName: r.trainerName,
        paidOn: r.paid.paidOn,
        total: 0,
        rows: [],
      };
      g.total += r.paid.amount;
      g.rows.push(r);
      groups.set(r.paid.payoutId, g);
    }
    return [...groups.values()].sort(
      (a, b) =>
        b.paidOn.localeCompare(a.paidOn) || a.trainerName.localeCompare(b.trainerName, "de"),
    );
  }, [rows]);

  function togglePayout(id: string) {
    setOpenPayouts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totals = useMemo(() => {
    const byTrainer = new Map<
      string,
      { name: string; open: number; paid: number; count: number }
    >();
    for (const r of rows) {
      const t = byTrainer.get(r.trainerId) ?? { name: r.trainerName, open: 0, paid: 0, count: 0 };
      t.count += 1;
      if (r.paid) t.paid += r.paid.amount;
      else if (!blocker(r)) t.open += r.amount ?? 0;
      byTrainer.set(r.trainerId, t);
    }
    return byTrainer;
  }, [rows]);

  const selectedRows = rows.filter((r) => selected.has(key(r)));
  const selectedTrainers = new Set(selectedRows.map((r) => r.trainerId));
  const selectedSum = selectedRows.reduce((s, r) => s + (r.amount ?? 0), 0);
  const selectedTrainerId = selectedTrainers.size === 1 ? [...selectedTrainers][0] : null;
  const alreadyPaidYear = selectedTrainerId ? (data?.paidInYear[selectedTrainerId] ?? 0) : 0;
  const afterPayout = alreadyPaidYear + selectedSum;

  function toggle(r: BillingRow) {
    if (blocker(r) || r.paid) return;
    setSelected((prev) => {
      const next = new Set(prev);
      const k = key(r);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function selectAllPayable(forTrainer: string) {
    setSelected(
      new Set(rows.filter((r) => r.trainerId === forTrainer && !r.paid && !blocker(r)).map(key)),
    );
  }

  async function confirmPayout() {
    if (!selectedTrainerId || selectedRows.length === 0) return;
    setBusy(true);
    try {
      const res = await createTrainerPayout({
        data: {
          trainerId: selectedTrainerId,
          sessionIds: selectedRows.map((r) => r.sessionId),
          paidOn,
        },
      });
      toast.success(`Auszahlung von ${formatEuro(res.total)} (${res.count} Termine) bestätigt.`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auszahlung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function undoPayout(payoutId: string) {
    if (
      !window.confirm(
        "Diese Auszahlung wirklich rückgängig machen? Die Termine sind danach wieder offen.",
      )
    )
      return;
    try {
      await deleteTrainerPayout({ data: { id: payoutId } });
      toast.success("Auszahlung rückgängig gemacht.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehlgeschlagen.");
    }
  }

  function exportCsv() {
    const header = [
      "Trainer:in",
      "Kurs",
      "Kursart",
      "Termin",
      "Datum",
      "Zeit",
      "Stunden",
      "Satz",
      "Betrag",
      "Status",
    ];
    const lines = rows.map((r) =>
      [
        r.trainerName,
        r.courseName,
        r.programName ?? "",
        `${r.sessionIndex}`,
        formatDateBerlin(r.date),
        timeText(r),
        r.hours?.toString().replace(".", ",") ?? "",
        r.rate?.toFixed(2).replace(".", ",") ?? "",
        r.amount?.toFixed(2).replace(".", ",") ?? "",
        r.paid ? `ausgezahlt am ${formatDateBerlin(r.paid.paidOn)}` : (blocker(r) ?? "offen"),
      ]
        .map(csvCell)
        .join(";"),
    );
    const blob = new Blob(["﻿" + [header.map(csvCell).join(";"), ...lines].join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `uebungsleiter-abrechnung-${from || "anfang"}-${to || "heute"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          Von
          <Input
            type="date"
            className="mt-1 w-40"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Bis
          <Input
            type="date"
            className="mt-1 w-40"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Kurs
          <select
            className={`${selectCls} mt-1 block`}
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            <option value="">Alle Kurse</option>
            {(data?.courses ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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
            {(data?.trainers ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Als CSV
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Es erscheinen nur Einsätze, bei denen der Vorstand die Anwesenheit bestätigt hat. Gezahlt
        wird nur bei Zuteilung zum Termin, festgelegten Stunden und erfasstem Satz. Die Stunden pro
        Termin legst du je Kursart (oder je Kurs) im Reiter „Stundensätze“ fest, die tatsächliche
        Einsatzzeit zählt nicht.
      </p>

      {totals.size > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...totals.entries()].map(([id, t]) => {
            const paidYear = data?.paidInYear[id] ?? 0;
            const warn = paidYear + t.open >= ANNUAL_ALLOWANCE * WARN_FRACTION;
            const over = paidYear + t.open > ANNUAL_ALLOWANCE;
            return (
              <Card key={id} className="border-0 shadow-soft">
                <CardContent className="space-y-1 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{t.name}</div>
                    <Button size="sm" variant="ghost" onClick={() => selectAllPayable(id)}>
                      Offene wählen
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t.count} Termine · offen {formatEuro(t.open)} · ausgezahlt {formatEuro(t.paid)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {data?.year}: bereits {formatEuro(paidYear)} von {formatEuro(ANNUAL_ALLOWANCE)}{" "}
                    ausgezahlt
                  </div>
                  {warn && (
                    <div
                      className={`flex items-center gap-1 text-xs font-medium ${over ? "text-destructive" : "text-amber-600"}`}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {over
                        ? "Mit den offenen Terminen wird der Freibetrag überschritten."
                        : "Freibetrag fast ausgeschöpft."}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedRows.length > 0 && (
        <Card className="border-0 shadow-soft">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="text-sm">
              {selectedTrainerId ? (
                <>
                  <span className="font-semibold">{selectedRows.length} Termine</span> ·{" "}
                  <span className="font-semibold">{formatEuro(selectedSum)}</span> für{" "}
                  {selectedRows[0].trainerName}
                  {afterPayout > ANNUAL_ALLOWANCE ? (
                    <span className="ml-2 font-medium text-destructive">
                      Achtung: damit {formatEuro(afterPayout)} im Jahr – über dem Freibetrag von{" "}
                      {formatEuro(ANNUAL_ALLOWANCE)}.
                    </span>
                  ) : afterPayout >= ANNUAL_ALLOWANCE * WARN_FRACTION ? (
                    <span className="ml-2 font-medium text-amber-600">
                      Damit {formatEuro(afterPayout)} im Jahr (Freibetrag{" "}
                      {formatEuro(ANNUAL_ALLOWANCE)}).
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-destructive">
                  Bitte Termine nur einer Person auswählen (eine Überweisung je Person).
                </span>
              )}
            </div>
            <div className="flex items-end gap-2">
              <label className="text-xs text-muted-foreground">
                Überwiesen am
                <Input
                  type="date"
                  className="mt-1 w-40"
                  value={paidOn}
                  onChange={(e) => setPaidOn(e.target.value)}
                />
              </label>
              <Button onClick={confirmPayout} disabled={!selectedTrainerId || busy || !paidOn}>
                Auszahlung bestätigen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-soft">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Wird geladen …</div>
          ) : openRows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              {rows.length === 0
                ? "Keine bestätigten Einsätze im gewählten Zeitraum."
                : "Keine offenen Einsätze – alles ausgezahlt."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Trainer:in</TableHead>
                  <TableHead>Kurs</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-right">Std.</TableHead>
                  <TableHead className="text-right">Satz</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openRows.map((r) => {
                  const b = blocker(r);
                  return (
                    <TableRow key={key(r)}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(key(r))}
                          disabled={!!b || !!r.paid}
                          onCheckedChange={() => toggle(r)}
                          aria-label="Termin auswählen"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{r.trainerName}</TableCell>
                      <TableCell>
                        <div>{r.courseName}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.sessionIndex}. Termin{r.programName ? ` · ${r.programName}` : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDateBerlin(r.date)}
                        <div className="text-xs text-muted-foreground">{timeText(r)}</div>
                      </TableCell>
                      <TableCell className="text-right">{r.hours ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {r.rate !== null ? formatEuro(r.rate) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.amount !== null ? formatEuro(r.amount) : "—"}
                      </TableCell>
                      <TableCell>
                        {b ? (
                          <Badge variant="outline" className="text-destructive">
                            {b}
                          </Badge>
                        ) : (
                          <Badge>offen</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!loading && payoutGroups.length > 0 && (
        <Card className="border-0 shadow-soft">
          <CardContent className="p-0">
            <div className="border-b px-4 py-3 font-medium">
              Ausgezahlt{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({payoutGroups.length} Überweisungen ·{" "}
                {payoutGroups.reduce((n, g) => n + g.rows.length, 0)} Termine)
              </span>
            </div>
            <ul className="divide-y">
              {payoutGroups.map((g) => {
                const isOpen = openPayouts.has(g.id);
                return (
                  <li key={g.id}>
                    <div className="flex items-center gap-2 px-4 py-2">
                      <button
                        type="button"
                        className="flex flex-1 items-center gap-2 text-left text-sm"
                        aria-expanded={isOpen}
                        onClick={() => togglePayout(g.id)}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                        <span className="w-24 shrink-0">{formatDateBerlin(g.paidOn)}</span>
                        <span className="font-medium">{g.trainerName}</span>
                        <span className="text-muted-foreground">
                          · {g.rows.length} Termine · {formatEuro(g.total)}
                        </span>
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label="Auszahlung rückgängig machen"
                        onClick={() => undoPayout(g.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {isOpen && (
                      <Table>
                        <TableBody>
                          {g.rows.map((r) => (
                            <TableRow key={key(r)} className="text-muted-foreground">
                              <TableCell className="w-10" />
                              <TableCell>
                                <div>{r.courseName}</div>
                                <div className="text-xs">
                                  {r.sessionIndex}. Termin
                                  {r.programName ? ` · ${r.programName}` : ""}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">
                                {formatDateBerlin(r.date)}
                                <div className="text-xs">{timeText(r)}</div>
                              </TableCell>
                              <TableCell className="text-right">{r.hours ?? "—"} Std.</TableCell>
                              <TableCell className="text-right">
                                {r.paid ? formatEuro(r.paid.amount) : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProgramHoursRow({
  program,
  onSaved,
}: {
  program: BillingOverview["programs"][number];
  onSaved: () => Promise<void>;
}) {
  const initial = program.billedHours === null ? "" : String(program.billedHours).replace(".", ",");
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);

  async function save() {
    if (value === initial) return;
    const trimmed = value.trim();
    const hours = trimmed === "" ? null : Number(trimmed.replace(",", "."));
    if (hours !== null && (!Number.isFinite(hours) || hours <= 0 || hours > 12)) {
      toast.error("Bitte eine Stundenzahl zwischen 0 und 12 angeben.");
      setValue(initial);
      return;
    }
    try {
      await setProgramBilledHours({ data: { programId: program.id, hours } });
      toast.success(`Stunden für „${program.name}“ gespeichert.`);
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
      setValue(initial);
    }
  }

  return (
    <label className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
      <span>{program.name}</span>
      <span className="flex items-center gap-1">
        <Input
          inputMode="decimal"
          className="h-9 w-20 text-right"
          value={value}
          placeholder="—"
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        <span className="text-xs text-muted-foreground">Std.</span>
      </span>
    </label>
  );
}

/** Stundensätze je Trainer:in und Kursart mit „gültig ab“. */
export function TrainerRates() {
  const [data, setData] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [trainerId, setTrainerId] = useState("");
  const [programId, setProgramId] = useState("");
  const [rate, setRate] = useState("");
  const [validFrom, setValidFrom] = useState(todayBerlinIso());
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await getBillingOverview({ data: { from: "2999-01-01" } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sätze konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const nameOf = (id: string) => data?.trainers.find((t) => t.id === id)?.name ?? "Unbekannt";

  async function save() {
    const value = Number(rate.replace(",", "."));
    if (!trainerId || !Number.isFinite(value) || value < 0) {
      toast.error("Bitte Trainer:in und einen gültigen Stundensatz angeben.");
      return;
    }
    try {
      await saveTrainerRate({
        data: { trainerId, programId: programId || null, hourlyRate: value, validFrom },
      });
      toast.success("Satz gespeichert.");
      setRate("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Diesen Satz löschen? Bereits ausgezahlte Beträge bleiben unverändert."))
      return;
    try {
      await deleteTrainerRate({ data: { id } });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
    }
  }

  const rates = (data?.rates ?? [])
    .filter((r) => !filter || r.trainer_id === filter)
    .sort(
      (a, b) =>
        nameOf(a.trainer_id).localeCompare(nameOf(b.trainer_id), "de") ||
        (a.programName ?? "").localeCompare(b.programName ?? "", "de") ||
        b.valid_from.localeCompare(a.valid_from),
    );

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-soft">
        <CardContent className="space-y-3 p-4">
          <div className="font-medium">Abgerechnete Stunden je Termin und Kursart</div>
          <p className="text-sm text-muted-foreground">
            Diese Stunden werden pro Termin vergütet, unabhängig von der tatsächlichen Einsatzzeit.
            Bei einzelnen Kursen kann das im Kurs selbst überschrieben werden.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(data?.programs ?? []).map((p) => (
              <ProgramHoursRow key={p.id} program={p} onSaved={load} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-soft">
        <CardContent className="space-y-3 p-4">
          <div className="text-sm text-muted-foreground">
            Stundensatz je Trainer:in und Kursart. Ein neuer Satz gilt für Termine ab dem „gültig
            ab“-Datum; frühere Termine behalten den alten Satz. „Alle Kursarten“ ist der
            Standardsatz, wenn für eine Kursart kein eigener Satz erfasst ist.
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-muted-foreground">
              Trainer:in
              <select
                className={`${selectCls} mt-1 block`}
                value={trainerId}
                onChange={(e) => setTrainerId(e.target.value)}
              >
                <option value="">Bitte wählen</option>
                {(data?.trainers ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Kursart
              <select
                className={`${selectCls} mt-1 block`}
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
              >
                <option value="">Alle Kursarten (Standard)</option>
                {(data?.programs ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Satz je Stunde (€)
              <Input
                inputMode="decimal"
                className="mt-1 w-32"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="z. B. 20,00"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Gültig ab
              <Input
                type="date"
                className="mt-1 w-40"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
            </label>
            <Button onClick={save}>Satz speichern</Button>
          </div>
        </CardContent>
      </Card>

      <label className="block text-xs text-muted-foreground">
        Anzeigen für
        <select
          className={`${selectCls} mt-1 block`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Alle Trainer:innen</option>
          {(data?.trainers ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Wird geladen …</div>
          ) : rates.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">Noch keine Sätze erfasst.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trainer:in</TableHead>
                  <TableHead>Kursart</TableHead>
                  <TableHead className="text-right">Satz je Stunde</TableHead>
                  <TableHead>Gültig ab</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{nameOf(r.trainer_id)}</TableCell>
                    <TableCell>{r.programName ?? "Alle Kursarten (Standard)"}</TableCell>
                    <TableCell className="text-right">{formatEuro(r.hourly_rate)}</TableCell>
                    <TableCell>{formatDateBerlin(r.valid_from)}</TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label="Satz löschen"
                        onClick={() => remove(r.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
