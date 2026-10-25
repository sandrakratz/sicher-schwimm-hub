import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { applyAssignments } from "@/lib/dienstplan.functions";
import {
  addDays,
  indexPlan,
  sessionLabel,
  suggestPlan,
  type PlanData,
  type Proposal,
  type Unfilled,
} from "@/lib/dienstplan";
import { todayBerlinIso } from "@/lib/format";

/** Vorschlag für die Grundeinteilung: füllt nur Lücken, nichts wird ohne Bestätigung geändert. */
export function AutoPlan({ data, onChanged }: { data: PlanData; onChanged: () => void }) {
  const apply = useServerFn(applyAssignments);
  const today = todayBerlinIso();
  const [days, setDays] = useState("28");
  const [course, setCourse] = useState("all");
  const [includeOpen, setIncludeOpen] = useState(false);
  const [notify, setNotify] = useState(true);
  const [result, setResult] = useState<{ proposals: Proposal[]; unfilled: Unfilled[] } | null>(
    null,
  );
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const ix = useMemo(() => indexPlan(data), [data]);
  const courses = useMemo(() => {
    const m = new Map<string, string>();
    data.sessions.forEach((s) => m.set(s.courseId, s.courseName));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "de"));
  }, [data.sessions]);

  const key = (p: Proposal) => `${p.sessionId}|${p.trainerId}`;

  function compute() {
    const limit = days === "all" ? "9999-12-31" : addDays(today, Number(days));
    const ids = new Set(
      data.sessions
        .filter(
          (s) => s.date >= today && s.date <= limit && (course === "all" || s.courseId === course),
        )
        .map((s) => s.id),
    );
    const res = suggestPlan(data, { sessionIds: ids, includeOpen });
    setResult(res);
    setPicked(new Set(res.proposals.map(key)));
  }

  async function takeOver() {
    if (!result) return;
    const chosen = result.proposals.filter((p) => picked.has(key(p)));
    if (!chosen.length) return;
    setBusy(true);
    try {
      const res = await apply({
        data: {
          changes: chosen.map((p) => ({
            sessionId: p.sessionId,
            trainerId: p.trainerId,
            on: true,
          })),
          notify,
        },
      });
      toast.success(
        `${res.added} Einteilung(en) übernommen${res.mailed ? `, ${res.mailed} Mail(s) verschickt` : ""}`,
      );
      setResult(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Übernehmen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  const bySession = useMemo(() => {
    const m = new Map<string, Proposal[]>();
    result?.proposals.forEach((p) => m.set(p.sessionId, [...(m.get(p.sessionId) ?? []), p]));
    return [...m.entries()]
      .map(([sid, list]) => ({ session: ix.sessionById.get(sid)!, list }))
      .filter((x) => x.session)
      .sort((a, b) =>
        (a.session.date + (a.session.start ?? "")).localeCompare(
          b.session.date + (b.session.start ?? ""),
        ),
      );
  }, [result, ix]);

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Das System schlägt vor, wer die offenen Plätze übernimmt. Bestehende Einteilungen bleiben
        unverändert. Berücksichtigt werden Zusagen, Sperrzeiten und Überschneidungen; bevorzugt wird
        ein gleichbleibendes Team je Kurs und eine gleichmäßige Auslastung. Du siehst den Vorschlag,
        kannst einzelne Zeilen abwählen und bestätigst erst dann.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="14">Nächste 2 Wochen</SelectItem>
            <SelectItem value="28">Nächste 4 Wochen</SelectItem>
            <SelectItem value="56">Nächste 8 Wochen</SelectItem>
            <SelectItem value="all">Alle kommenden Termine</SelectItem>
          </SelectContent>
        </Select>
        <Select value={course} onValueChange={setCourse}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kurse</SelectItem>
            {courses.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={includeOpen} onCheckedChange={(v) => setIncludeOpen(!!v)} />
          Auch Trainer:innen ohne Rückmeldung einplanen
        </label>
        <Button onClick={compute}>
          <Wand2 className="h-4 w-4" /> Vorschlag berechnen
        </Button>
      </div>

      {result && (
        <div className="space-y-3">
          {result.proposals.length === 0 && (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                Es gibt nichts vorzuschlagen
                {includeOpen
                  ? "."
                  : " – oder niemand hat zugesagt. Mit dem Haken „ohne Rückmeldung“ werden auch nicht Befragte eingeplant."}
              </CardContent>
            </Card>
          )}

          {bySession.length > 0 && (
            <div className="divide-y rounded-lg border">
              {bySession.map(({ session, list }) => (
                <div key={session.id} className="p-3">
                  <div className="mb-1 text-sm font-medium">{sessionLabel(session)}</div>
                  <div className="space-y-1">
                    {list.map((p) => (
                      <label
                        key={key(p)}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={picked.has(key(p))}
                          onCheckedChange={(v) =>
                            setPicked((prev) => {
                              const n = new Set(prev);
                              if (v) n.add(key(p));
                              else n.delete(key(p));
                              return n;
                            })
                          }
                        />
                        <span className="font-medium">{ix.trainerById.get(p.trainerId)?.name}</span>
                        <span className="text-xs text-muted-foreground">{p.why}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.unfilled.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <div className="mb-1 font-semibold text-destructive">
                Hierfür findet das System niemanden:
              </div>
              <ul className="list-disc pl-5">
                {result.unfilled.map((u) => {
                  const s = ix.sessionById.get(u.sessionId);
                  return s ? (
                    <li key={u.sessionId}>
                      {sessionLabel(s)} – {u.missing} fehlt
                    </li>
                  ) : null;
                })}
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">
                Diese Termine bleiben unter „Lücken“ stehen; dort kannst du Ersatz anfragen.
              </p>
            </div>
          )}

          {result.proposals.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={busy || picked.size === 0} onClick={() => void takeOver()}>
                Ausgewählte übernehmen ({picked.size})
              </Button>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={notify} onCheckedChange={(v) => setNotify(!!v)} />
                Betroffene per Mail informieren (eine Mail je Person)
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
