import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { updateParticipantResult } from "@/lib/trainer-courses.functions";
import { findExamLevel, type ExamCriteriaState } from "@/lib/swim-exams";
import {
  DISCIPLINES,
  POOL_LENGTHS,
  STYLE_LABEL,
  formatClock,
  formatMeters,
  lapsNeeded,
  poolLengthForLocation,
  type PoolLength,
  type SwimStyle,
} from "@/lib/swim-disciplines";
import type { ParticipantResult } from "@/components/trainer/ParticipantResultEditor";
import { toast } from "sonner";

export type WatchParticipant = {
  id: string;
  name: string;
  no: number | null;
  result: ParticipantResult;
};

const MAX_SELECTED = 4;

type WakeLockLike = { release: () => Promise<void> };

/**
 * Mehrfach-Stoppuhr mit Bahnenzähler (wie MultiWatch) für bis zu vier
 * Kinder gleichzeitig. Beckenlänge kommt aus dem Kursort, die Lagen
 * werden getrennt gezählt und das Ergebnis geht direkt in den
 * Prüfungsnachweis.
 */
export function MultiWatch({
  location,
  participants,
  onSaved,
}: {
  location: string | null;
  participants: WatchParticipant[];
  onSaved?: (participantId: string, result: ParticipantResult) => void;
}) {
  const save = useServerFn(updateParticipantResult);
  const [pool, setPool] = useState<PoolLength>(() => poolLengthForLocation(location));
  const [disciplineKey, setDisciplineKey] = useState(DISCIPLINES[0]!.key);
  const [selected, setSelected] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<Record<string, SwimStyle[]>>({});
  const [stopped, setStopped] = useState<Record<string, number>>({});
  // Zwischenzeit: wann die Pflichtstrecke erreicht war (Uhr läuft weiter).
  const [splits, setSplits] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const startRef = useRef<number | null>(null);
  const wakeRef = useRef<WakeLockLike | null>(null);

  const discipline = DISCIPLINES.find(d => d.key === disciplineKey)!;
  const totalLaps = lapsNeeded(discipline.meters, pool);
  const bauchLaps = discipline.bauchMeters ? lapsNeeded(discipline.bauchMeters, pool) : 0;
  const rueckenLaps = discipline.rueckenMeters ? lapsNeeded(discipline.rueckenMeters, pool) : 0;
  const limit = discipline.minDurationSec ?? discipline.maxDurationSec ?? null;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (startRef.current != null) setElapsed((Date.now() - startRef.current) / 1000);
    }, 200);
    return () => window.clearInterval(id);
  }, [running]);

  // Display am Beckenrand wach halten, solange die Uhr läuft.
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockLike> } };
    if (running && nav.wakeLock) {
      nav.wakeLock.request("screen").then(l => { wakeRef.current = l; }).catch(() => {});
    }
    if (!running && wakeRef.current) {
      wakeRef.current.release().catch(() => {});
      wakeRef.current = null;
    }
    return () => {
      if (wakeRef.current) { wakeRef.current.release().catch(() => {}); wakeRef.current = null; }
    };
  }, [running]);

  function toggleSelect(id: string) {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length >= MAX_SELECTED
          ? (toast.info(`Höchstens ${MAX_SELECTED} Kinder gleichzeitig`), prev)
          : [...prev, id],
    );
  }

  function start() {
    startRef.current = Date.now();
    setElapsed(0);
    setLaps(Object.fromEntries(selected.map(id => [id, []])));
    setStopped({});
    setSplits({});
    setRunning(true);
  }

  function stopAll() {
    setRunning(false);
    startRef.current = null;
  }

  function reset() {
    stopAll();
    setElapsed(0);
    setLaps({});
    setStopped({});
    setSplits({});
  }

  function addLap(id: string, style: SwimStyle) {
    if (!running) return;
    if (navigator.vibrate) navigator.vibrate(20);
    const now = startRef.current != null ? (Date.now() - startRef.current) / 1000 : elapsed;
    setLaps(prev => {
      const next = [...(prev[id] || []), style];
      // Zwischenzeit festhalten, sobald die Pflichtstrecke erreicht ist –
      // die Uhr läuft danach bis zum Ende der Prüfungszeit weiter.
      if (next.length >= totalLaps) {
        setSplits(sp => (sp[id] != null ? sp : { ...sp, [id]: now }));
      }
      return { ...prev, [id]: next };
    });
  }

  function undoLap(id: string) {
    setLaps(prev => {
      const next = (prev[id] || []).slice(0, -1);
      if (next.length < totalLaps) {
        setSplits(sp => {
          if (sp[id] == null) return sp;
          const copy = { ...sp };
          delete copy[id];
          return copy;
        });
      }
      return { ...prev, [id]: next };
    });
  }

  function finishChild(id: string) {
    setStopped(prev => ({ ...prev, [id]: elapsed }));
  }

  function statsFor(id: string) {
    const list = laps[id] || [];
    const count = (s: SwimStyle) => list.filter(x => x === s).length;
    const brust = count("brust");
    const kraul = count("kraul");
    const ruecken = count("ruecken");
    const bauch = brust + kraul;
    const meters = list.length * pool;
    const time = stopped[id] ?? elapsed;
    const split = splits[id] ?? null;
    const distanceOk = list.length >= totalLaps;
    const bauchOk = bauch >= bauchLaps;
    const rueckenOk = ruecken >= rueckenLaps;
    const durationOk = discipline.minDurationSec ? time >= discipline.minDurationSec : true;
    const withinMax = discipline.maxDurationSec ? time <= discipline.maxDurationSec : true;
    return {
      list, brust, kraul, ruecken, bauch, meters, time, split,
      distanceOk, bauchOk, rueckenOk, durationOk, withinMax,
      passed: distanceOk && bauchOk && rueckenOk && durationOk && withinMax,
    };
  }

  async function saveResult(p: WatchParticipant) {
    const s = statsFor(p.id);
    const level = discipline.examLevel;
    const existingLevel = p.result.exam_level || "";
    // Ergebnis nur in den passenden Prüfungsnachweis schreiben.
    const criteria: ExamCriteriaState =
      existingLevel === level ? { ...(p.result.exam_criteria || {}) } : {};
    // Beim Dauerschwimmen: Zwischenzeit der Pflichtstrecke + Gesamtleistung.
    const value = formatClock(s.split ?? s.time);
    const total = discipline.minDurationSec
      ? `${s.list.length} Bahnen (${formatMeters(s.meters)}) in ${formatClock(s.time)}`
      : `${s.list.length} Bahnen (${formatMeters(s.meters)})`;
    criteria[discipline.criterionKey] = {
      done: s.passed,
      value: value.slice(0, 40),
      total: total.slice(0, 40),
    };
    setSavingId(p.id);
    try {
      const res = await save({
        data: {
          participantId: p.id,
          goalReached: p.result.goal_reached ?? null,
          badge: p.result.badge || findExamLevel(level)?.label || "",
          achievement: p.result.achievement || "",
          examLevel: level,
          examCriteria: criteria,
          examDate: p.result.exam_date || null,
          examPassNo: p.result.exam_pass_no || null,
        },
      });
      onSaved?.(p.id, {
        goal_reached: res.goal_reached,
        badge: res.badge,
        achievement: res.achievement,
        exam_level: res.exam_level,
        exam_criteria: res.exam_criteria,
        exam_date: res.exam_date,
        exam_pass_no: res.exam_pass_no,
      });
      toast.success(`Ergebnis für ${p.name} gespeichert`);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Speichern fehlgeschlagen");
    } finally {
      setSavingId(null);
    }
  }

  const chosen = participants.filter(p => selected.includes(p.id));
  const remaining = limit != null ? limit - elapsed : null;

  return (
    <div className="space-y-4">
      {/* Vorbereitung */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Prüfungsteil</Label>
          <Select value={disciplineKey} onValueChange={v => { setDisciplineKey(v); reset(); }}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DISCIPLINES.map(d => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Beckenlänge</Label>
          <Select value={String(pool)} onValueChange={v => { setPool(Number(v) as PoolLength); reset(); }}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              {POOL_LENGTHS.map(l => (
                <SelectItem key={l} value={String(l)}>{formatMeters(l)}-Becken</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Soll: {totalLaps} Bahnen ({formatMeters(discipline.meters)})
        {bauchLaps > 0 && ` · davon mind. ${bauchLaps} Bahnen Bauchlage (Brust/Kraul) und ${rueckenLaps} Bahnen Rücken`}
        {discipline.minDurationSec ? ` · volle ${formatClock(discipline.minDurationSec)} Minuten durchschwimmen` : ""}
        {discipline.maxDurationSec ? ` · Höchstzeit ${formatClock(discipline.maxDurationSec)}` : ""}
      </p>

      {!running && (
        <div className="space-y-2">
          <Label className="text-xs">Kinder auswählen (max. {MAX_SELECTED})</Label>
          <div className="grid gap-1 sm:grid-cols-2">
            {participants.map(p => (
              <label key={p.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                <span>{p.no != null && <span className="mr-1 font-semibold">{p.no}</span>}{p.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Master-Uhr */}
      <div className="rounded-lg border bg-muted/40 p-3 text-center">
        <div className="text-4xl font-bold tabular-nums">{formatClock(elapsed)}</div>
        {remaining != null && (
          <div className={`text-sm ${remaining <= 0 ? "text-green-700" : remaining < 60 ? "text-amber-600" : "text-muted-foreground"}`}>
            {remaining > 0 ? `noch ${formatClock(remaining)} bis ${formatClock(limit!)}` : `Zeit voll (${formatClock(limit!)})`}
          </div>
        )}
        <div className="mt-3 flex justify-center gap-2">
          {!running ? (
            <Button size="lg" className="h-12 px-8" disabled={selected.length === 0} onClick={start}>
              Start
            </Button>
          ) : (
            <Button size="lg" variant="destructive" className="h-12 px-8" onClick={stopAll}>Stopp</Button>
          )}
          <Button size="lg" variant="outline" className="h-12" onClick={reset}>Zurücksetzen</Button>
        </div>
      </div>

      {/* Spalten pro Kind */}
      {chosen.length > 0 && (
        <div
          className={`grid gap-3 ${chosen.length > 1 ? "grid-cols-2" : "grid-cols-1"} ${
            chosen.length >= 4 ? "lg:grid-cols-4" : chosen.length === 3 ? "lg:grid-cols-3" : ""
          }`}
        >
          {chosen.map(p => {
            const s = statsFor(p.id);
            return (
              <div key={p.id} className="rounded-lg border p-2">
                <div className="mb-1 flex items-center justify-between gap-1">
                  <span className="truncate text-sm font-semibold">
                    {p.no != null && <span className="mr-1">{p.no}</span>}{p.name}
                  </span>
                  {s.passed && <Badge className="bg-green-600">ok</Badge>}
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {s.list.length}<span className="text-sm font-normal text-muted-foreground">/{totalLaps}</span>
                </div>
                <div className="text-xs text-muted-foreground">{formatMeters(s.meters)}</div>
                {bauchLaps > 0 && (
                  <div className="mt-1 text-xs">
                    <div className={s.bauchOk ? "text-green-700" : ""}>Bauch {s.bauch}/{bauchLaps}</div>
                    <div className={s.rueckenOk ? "text-green-700" : ""}>Rücken {s.ruecken}/{rueckenLaps}</div>
                  </div>
                )}
                {stopped[p.id] != null && (
                  <div className="mt-1 text-xs font-medium">Zeit: {formatClock(stopped[p.id]!)}</div>
                )}

                <div className="mt-2 space-y-1">
                  {discipline.styles.map(st => (
                    <Button
                      key={st}
                      className="h-12 w-full text-base"
                      variant={st === "ruecken" ? "secondary" : "default"}
                      disabled={!running || stopped[p.id] != null}
                      onClick={() => addLap(p.id, st)}
                    >
                      +1 {STYLE_LABEL[st]}
                    </Button>
                  ))}
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      className="h-9 flex-1"
                      disabled={(laps[p.id] || []).length === 0}
                      onClick={() => undoLap(p.id)}
                    >
                      −1
                    </Button>
                    <Button
                      variant="outline"
                      className="h-9 flex-1"
                      disabled={!running || stopped[p.id] != null}
                      onClick={() => finishChild(p.id)}
                    >
                      Ziel
                    </Button>
                  </div>
                </div>

                {!running && s.list.length > 0 && (
                  <Button
                    size="sm"
                    className="mt-2 w-full"
                    disabled={savingId === p.id}
                    onClick={() => saveResult(p)}
                  >
                    {savingId === p.id ? "Speichert…" : "In Nachweis übernehmen"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MultiWatch;
