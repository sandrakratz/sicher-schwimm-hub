import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { listAdminCalendar, type CalendarEntry } from "@/lib/calendar.functions";
import { listTrainers } from "@/lib/trainers.functions";
import { Link } from "@tanstack/react-router";
import { CalendarDays, RefreshCw, HandHelping } from "lucide-react";
import { CourseRosterMatrix } from "@/components/admin/CourseRosterMatrix";

function shortDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export const Route = createFileRoute("/_authenticated/admin/kalender")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board"] } });
    } catch {
      throw redirect({ to: "/admin/benutzer" });
    }
  },
  head: () => ({
    meta: [
      { title: "Kurse & Termine – Verwaltung" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});

const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];
const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function fmtDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${wd}, ${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function fmtMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

function timeLabel(e: CalendarEntry): string {
  if (!e.startTime) return "Zeit offen";
  return e.endTime ? `${e.startTime}–${e.endTime} Uhr` : `${e.startTime} Uhr`;
}

/** Benötigte Trainer:innen pro Termin (Kurseinstellung, Vorgabe 2). */
const need = (e: CalendarEntry) => e.trainersNeeded ?? 2;

function Page() {
  const load = useServerFn(listAdminCalendar);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("kurse");
  const [scope, setScope] = useState<"upcoming" | "all">("upcoming");
  const [q, setQ] = useState("");
  const [courseId, setCourseId] = useState<string | null>(null);
  useEffect(() => {
    // Aus der Kursakte: ?kurs=… öffnet direkt die Einteilung dieses Kurses (auch wenn er schon läuft)
    const k = new URLSearchParams(window.location.search).get("kurs");
    if (k) {
      setCourseId(k);
      setScope("all");
      setTab("kurse");
    }
  }, []);
  const trainersFn = useServerFn(listTrainers);
  const [trainers, setTrainers] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    trainersFn()
      .then((t: any) => setTrainers(t || []))
      .catch(() => {}); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      setEntries(await load());
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const today = useMemo(
    () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date()),
    [],
  );

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
        const mk = monthKey(e.date);
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
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" /> Kurse &amp; Termine
          </h1>
          <p className="text-sm text-muted-foreground">
            Hier teilst du die Trainer:innen eines Kurses für alle Termine ein und siehst die
            Vereinstermine mit Helfern. Den Überblick über Lücken, Ersatzsuche und Wochenplan
            findest du im{" "}
            <Link
              to="/admin/dienstplan"
              className="text-primary underline-offset-2 hover:underline"
            >
              Dienstplan
            </Link>
            .
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Aktualisieren
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="kurse">Kurse einteilen</TabsTrigger>
          <TabsTrigger value="verein">Vereinstermine &amp; Helfer</TabsTrigger>
        </TabsList>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Select value={scope} onValueChange={(v: "upcoming" | "all") => setScope(v)}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">Ab heute</SelectItem>
              <SelectItem value="all">Alle Termine</SelectItem>
            </SelectContent>
          </Select>
          <Input
            className="w-64"
            placeholder={tab === "kurse" ? "Kurs suchen…" : "Suche (Termin, Ort, Person)…"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {loading && (
          <div className="mt-4 text-sm text-muted-foreground">Kalender wird geladen…</div>
        )}

        <TabsContent value="kurse" className="mt-4 space-y-4">
          {!loading && courses.length === 0 && (
            <div className="text-sm text-muted-foreground">Keine Kurstermine gefunden.</div>
          )}
          {courses.length > 0 && (
            <Select value={courseId ?? ""} onValueChange={setCourseId}>
              <SelectTrigger className="w-full max-w-xl">
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
                      ⚠️ {incomplete} Termin(e) nicht voll besetzt –{" "}
                      <Link to="/admin/dienstplan" className="underline-offset-2 hover:underline">
                        im Dienstplan ansehen
                      </Link>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">✓ besetzt</span>
                  )}
                </div>
                {withoutTime > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {withoutTime} Termin(e) ohne Uhrzeit – Uhrzeit unter „Kurse → Termine“
                    eintragen.
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
        </TabsContent>

        <TabsContent value="verein" className="mt-4 space-y-4">
          {!loading && byMonth.length === 0 && (
            <div className="text-sm text-muted-foreground">Keine Vereinstermine gefunden.</div>
          )}
          {byMonth.map(([mk, days]) => (
            <CollapsibleCard
              key={mk}
              storageKey={`cal-${mk}`}
              title={fmtMonth(mk)}
              subtitle={`${[...days.values()].reduce((s, l) => s + l.length, 0)} Termin(e)`}
            >
              <div className="space-y-4">
                {[...days.entries()]
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([day, list]) => (
                    <div key={day}>
                      <div className="mb-2 text-sm font-semibold">
                        {fmtDay(day)}
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
                                  <HandHelping className="h-3.5 w-3.5" />
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
