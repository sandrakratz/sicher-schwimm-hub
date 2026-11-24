import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { HandHelping } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listAdminCalendar, type CalendarEntry } from "@/lib/calendar.functions";
import { listTrainers } from "@/lib/trainers.functions";
import { CourseRosterMatrix } from "@/components/admin/CourseRosterMatrix";
import { formatMonthYear, formatWeekdayLong, todayBerlinIso } from "@/lib/format";

function shortDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function timeLabel(e: CalendarEntry): string {
  if (!e.startTime) return "Zeit offen";
  return e.endTime ? `${e.startTime}–${e.endTime} Uhr` : `${e.startTime} Uhr`;
}

/** Benötigte Trainer:innen pro Termin (Kurseinstellung, Vorgabe 2). */
const need = (e: CalendarEntry) => e.trainersNeeded ?? 2;

/**
 * Teil des Dienstplans (früher eigene Seite „Kurse & Termine“):
 * - `kurse`: Trainer:innen eines Kurses für alle Termine einteilen (über applyAssignments,
 *   also mit Protokoll und Mail an die Trainer:innen)
 * - `verein`: Vereinstermine mit Helfer-Zusagen (nur lesen)
 */
export function CalendarAssign({
  view,
  initialCourseId,
}: {
  view: "kurse" | "verein";
  /** Kurs vorauswählen (z. B. aus der Kursseite „Trainer einteilen“) */
  initialCourseId?: string;
}) {
  const load = useServerFn(listAdminCalendar);
  const trainersFn = useServerFn(listTrainers);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [trainers, setTrainers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  // Mit vorgewähltem Kurs auch vergangene Termine zeigen (der Kurs kann schon laufen)
  const [scope, setScope] = useState<"upcoming" | "all">(initialCourseId ? "all" : "upcoming");
  const [q, setQ] = useState("");
  const [courseId, setCourseId] = useState<string | null>(initialCourseId ?? null);

  useEffect(() => {
    trainersFn()
      .then((t) => setTrainers((t as { id: string; name: string }[]) || []))
      .catch(() => {});
    load()
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [load, trainersFn]);

  const today = todayBerlinIso();

  // Kurse mit ihren Terminen im gewählten Zeitraum
  const courses = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    entries.forEach((e) => {
      if (e.kind !== "session" || !e.courseId) return;
      if (scope === "upcoming" && e.date < today) return;
      map.set(e.courseId, [...(map.get(e.courseId) ?? []), e]);
    });
    return [...map.entries()]
      .map(([id, l]) => ({ id, list: l.sort((a, b) => a.date.localeCompare(b.date)) }))
      .sort((a, b) => a.list[0].date.localeCompare(b.list[0].date));
  }, [entries, scope, today]);

  const needle = q.trim().toLowerCase();
  const courseOptions = useMemo(
    () =>
      courses.filter(
        (c) =>
          c.id === courseId ||
          !needle ||
          `${c.list[0].title} ${c.list[0].location ?? ""}`.toLowerCase().includes(needle),
      ),
    [courses, needle, courseId],
  );
  const selected = courses.find((c) => c.id === courseId) ?? null;
  // Ohne Auswahl (oder wenn der Kurs im Zeitraum nicht vorkommt) den ersten Kurs zeigen
  useEffect(() => {
    if (!loading && !selected && courses.length > 0) setCourseId(courses[0].id);
  }, [loading, selected, courses]);

  function applyChange(sessionId: string, trainerId: string, on: boolean) {
    const name = trainers.find((t) => t.id === trainerId)?.name ?? "Unbekannt";
    setEntries((prev) =>
      prev.map((x) => {
        if (x.kind !== "session" || x.id !== sessionId) return x;
        const assigned = new Set(x.assignedIds ?? []);
        const tr = x.trainers.filter((t) => t.id !== trainerId);
        if (on) {
          assigned.add(trainerId);
          tr.push({ id: trainerId, name });
        } else assigned.delete(trainerId);
        return { ...x, assignedIds: [...assigned], trainers: tr };
      }),
    );
  }

  // Vereinstermine nach Monat und Tag
  const byMonth = useMemo(() => {
    const map = new Map<string, Map<string, CalendarEntry[]>>();
    entries
      .filter((e) => e.kind === "event")
      .filter((e) => scope === "all" || e.date >= today)
      .filter((e) => {
        if (!needle) return true;
        return [e.title, e.subtitle ?? "", e.location ?? "", ...e.helpers]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .forEach((e) => {
        const mk = e.date.slice(0, 7);
        const days = map.get(mk) ?? new Map<string, CalendarEntry[]>();
        days.set(e.date, [...(days.get(e.date) ?? []), e]);
        map.set(mk, days);
      });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [entries, scope, needle, today]);

  const incomplete = selected
    ? selected.list.filter((s) => (s.assignedIds ?? []).length < need(s)).length
    : 0;
  const withoutTime = selected ? selected.list.filter((s) => !s.startTime).length : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={scope} onValueChange={(v: "upcoming" | "all") => setScope(v)}>
          <SelectTrigger className="w-52" aria-label="Zeitraum">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Ab heute</SelectItem>
            <SelectItem value="all">Alle Termine</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="w-64"
          aria-label="Suche"
          placeholder={view === "kurse" ? "Kurs suchen…" : "Suche (Termin, Ort, Person)…"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading && <div className="text-sm text-muted-foreground">Wird geladen…</div>}

      {view === "kurse" && (
        <>
          {!loading && courses.length === 0 && (
            <div className="text-sm text-muted-foreground">Keine Kurstermine gefunden.</div>
          )}
          {courses.length > 0 && (
            <Select value={courseId ?? ""} onValueChange={setCourseId}>
              <SelectTrigger className="w-full max-w-xl" aria-label="Kurs">
                <SelectValue placeholder="Kurs wählen…" />
              </SelectTrigger>
              <SelectContent>
                {courseOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.list[0].title} · {shortDate(c.list[0].date)} –{" "}
                    {shortDate(c.list[c.list.length - 1].date)}
                  </SelectItem>
                ))}
                {courseOptions.length === 0 && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    Kein Kurs passt zur Suche.
                  </div>
                )}
              </SelectContent>
            </Select>
          )}
          {selected && (
            <Card>
              <CardContent className="space-y-3 pt-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-semibold">{selected.list[0].title}</span>
                  <span className="text-muted-foreground">
                    {selected.list.length} Termin(e)
                    {selected.list[0].location ? ` · ${selected.list[0].location}` : ""}
                  </span>
                  {incomplete > 0 ? (
                    <span className="text-destructive">
                      {incomplete} Termin(e) nicht voll besetzt
                    </span>
                  ) : (
                    <span className="text-muted-foreground">✓ besetzt</span>
                  )}
                </div>
                {withoutTime > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {withoutTime} Termin(e) ohne Uhrzeit – Uhrzeit auf der Kursseite unter „Termine
                    &amp; Trainer“ eintragen.
                  </div>
                )}
                <CourseRosterMatrix
                  key={selected.id}
                  sessions={selected.list}
                  trainers={trainers}
                  onChanged={applyChange}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {view === "verein" && (
        <>
          {!loading && byMonth.length === 0 && (
            <div className="text-sm text-muted-foreground">Keine Vereinstermine gefunden.</div>
          )}
          {byMonth.map(([mk, days]) => (
            <CollapsibleCard
              key={mk}
              storageKey={`cal-${mk}`}
              title={formatMonthYear(mk)}
              subtitle={`${[...days.values()].reduce((s, l) => s + l.length, 0)} Termin(e)`}
            >
              <div className="space-y-4">
                {[...days.entries()]
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([day, list]) => (
                    <div key={day}>
                      <div className="mb-2 text-sm font-semibold">
                        {formatWeekdayLong(day)}
                        {day === today && <Badge className="ml-2">heute</Badge>}
                      </div>
                      <div className="space-y-2">
                        {list.map((e) => (
                          <div key={`${e.kind}-${e.id}`} className="rounded-lg border p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="w-32 shrink-0 text-sm font-medium tabular-nums">
                                {timeLabel(e)}
                              </span>
                              <span className="font-medium">{e.title}</span>
                              {e.location && (
                                <span className="text-xs text-muted-foreground">{e.location}</span>
                              )}
                            </div>
                            {e.subtitle && (
                              <div className="mt-1 text-xs text-muted-foreground">{e.subtitle}</div>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                              {(e.helpers.length > 0 || e.helperNeed.length > 0) && (
                                <span className="flex items-center gap-1">
                                  <HandHelping className="h-3.5 w-3.5" aria-hidden="true" />
                                  {e.helpers.length > 0
                                    ? e.helpers.join(", ")
                                    : "noch keine Zusagen"}
                                </span>
                              )}
                              {e.helperNeed.map((g) => (
                                <Badge
                                  key={g.name}
                                  variant={g.filled >= g.needed ? "secondary" : "outline"}
                                  className={
                                    g.filled >= g.needed
                                      ? ""
                                      : "border-destructive text-destructive"
                                  }
                                >
                                  {g.name}: {g.filled}/{g.needed}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </CollapsibleCard>
          ))}
        </>
      )}
    </div>
  );
}
