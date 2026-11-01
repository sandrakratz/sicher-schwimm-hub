import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addDays,
  blackoutOn,
  gapOf,
  indexPlan,
  overlaps,
  shortDate,
  timeText,
  type PlanData,
  type PlanSession,
} from "@/lib/dienstplan";
import { todayBerlinIso } from "@/lib/format";

/** Übersicht nach Kursen: pro Kurs eine Karte, darin jeder Termin mit seinem Team auf einen Blick. */
export function CoursePlan({
  data,
  onPick,
}: {
  data: PlanData;
  onPick: (sessionId: string) => void;
}) {
  const today = todayBerlinIso();
  const [days, setDays] = useState("42");
  const [q, setQ] = useState("");
  const [onlyGaps, setOnlyGaps] = useState(false);
  const ix = useMemo(() => indexPlan(data), [data]);

  const courses = useMemo(() => {
    const limit = days === "all" ? "9999-12-31" : addDays(today, Number(days));
    const needle = q.trim().toLowerCase();
    const map = new Map<string, PlanSession[]>();
    for (const s of data.sessions) {
      if (s.date < today || s.date > limit) continue;
      map.set(s.courseId, [...(map.get(s.courseId) ?? []), s]);
    }
    return [...map.values()]
      .map((list) =>
        [...list].sort((a, b) => (a.date + (a.start ?? "")).localeCompare(b.date + (b.start ?? ""))),
      )
      .filter((list) => {
        const first = list[0]!;
        if (onlyGaps && !list.some((s) => gapOf(ix, s) > 0)) return false;
        if (!needle) return true;
        return (
          `${first.courseName} ${first.location ?? ""}`.toLowerCase().includes(needle) ||
          list.some((s) =>
            [...(ix.teamBySession.get(s.id) ?? [])].some((id) =>
              (ix.trainerById.get(id)?.name ?? "").toLowerCase().includes(needle),
            ),
          )
        );
      })
      .sort((a, b) =>
        (a[0]!.date + (a[0]!.start ?? "")).localeCompare(b[0]!.date + (b[0]!.start ?? "")),
      );
  }, [data.sessions, ix, today, days, q, onlyGaps]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="14">Nächste 2 Wochen</SelectItem>
            <SelectItem value="42">Nächste 6 Wochen</SelectItem>
            <SelectItem value="90">Nächste 3 Monate</SelectItem>
            <SelectItem value="all">Alle kommenden</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="w-64 pl-8"
            placeholder="Kurs, Ort oder Person…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button
          variant={onlyGaps ? "default" : "outline"}
          size="sm"
          onClick={() => setOnlyGaps((v) => !v)}
        >
          Nur Kurse mit Lücke
        </Button>
      </div>

      {courses.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Keine Kurse im gewählten Zeitraum.
          </CardContent>
        </Card>
      )}

      {courses.map((list) => {
        const first = list[0]!;
        const gaps = list.filter((s) => gapOf(ix, s) > 0).length;
        return (
          <Card key={first.courseId}>
            <CardContent className="space-y-2 pt-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="text-base font-semibold">{first.courseName}</div>
                {first.location && (
                  <span className="text-xs text-muted-foreground">{first.location}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {list.length} Termin{list.length === 1 ? "" : "e"} · {first.needed} Trainer:in
                  {first.needed === 1 ? "" : "nen"} pro Termin
                </span>
                {gaps > 0 ? (
                  <Badge variant="outline" className="border-destructive text-destructive">
                    {gaps} Termin{gaps === 1 ? "" : "e"} mit Lücke
                  </Badge>
                ) : (
                  <Badge variant="secondary">✓ komplett besetzt</Badge>
                )}
                <a
                  href={`/admin/kalender?kurs=${first.courseId}`}
                  className="ml-auto text-xs text-primary underline-offset-2 hover:underline"
                >
                  Kurs bearbeiten
                </a>
              </div>

              <div className="divide-y rounded-lg border">
                {list.map((s) => {
                  const team = [...(ix.teamBySession.get(s.id) ?? [])];
                  const gap = gapOf(ix, s);
                  return (
                    <div
                      key={s.id}
                      className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm ${
                        team.length === 0 ? "bg-destructive/5" : ""
                      }`}
                    >
                      <span className="w-28 shrink-0 font-medium">
                        {shortDate(s.date)}
                        {s.date === today && <Badge className="ml-1">heute</Badge>}
                      </span>
                      <span className="w-32 shrink-0 text-xs tabular-nums text-muted-foreground">
                        {timeText(s)}
                      </span>
                      <div className="flex min-w-48 flex-1 flex-wrap gap-1">
                        {team.map((id) => {
                          const block = blackoutOn(data.blackouts, id, s.date);
                          const clash = (ix.sessionsByTrainer.get(id) ?? []).some(
                            (o) => o.id !== s.id && overlaps(o, s),
                          );
                          const open = ix.unconfirmed.has(`${s.id}|${id}`);
                          const bad = !!block || clash;
                          return (
                            <span
                              key={id}
                              title={
                                bad
                                  ? block
                                    ? "In einer Sperrzeit!"
                                    : "Doppelbelegung!"
                                  : open
                                    ? "noch nicht bestätigt"
                                    : undefined
                              }
                              className={`rounded px-1.5 py-0.5 text-xs ${
                                bad
                                  ? "bg-destructive text-destructive-foreground"
                                  : "bg-primary/10 text-foreground"
                              }${open ? " ring-2 ring-amber-300" : ""}`}
                            >
                              {ix.trainerById.get(id)?.name ?? "?"}
                            </span>
                          );
                        })}
                        {gap > 0 && (
                          <span className="rounded border border-dashed border-destructive px-1.5 py-0.5 text-xs text-destructive">
                            {gap} fehlt
                          </span>
                        )}
                      </div>
                      {gap > 0 && (
                        <Button size="sm" variant="outline" onClick={() => onPick(s.id)}>
                          Besetzen
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
