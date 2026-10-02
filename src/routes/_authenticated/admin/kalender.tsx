import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { CalendarDays, RefreshCw, Users, HandHelping, X, Plus } from "lucide-react";
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
      { title: "Kurskalender & Dienstplan – Verwaltung" },
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
  const [kind, setKind] = useState<"all" | "session" | "event">("all");
  const [scope, setScope] = useState<"upcoming" | "all">("upcoming");
  const [q, setQ] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [picker, setPicker] = useState<string | null>(null);
  const [view, setView] = useState<"course" | "date">("course");
  const [focusCourse, setFocusCourse] = useState<string | null>(null);
  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("kurs");
    if (k) {
      setFocusCourse(k);
      setView("course");
    }
  }, []);
  const trainersFn = useServerFn(listTrainers);
  const [trainers, setTrainers] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    trainersFn()
      .then((t: any) => setTrainers(t || []))
      .catch(() => {}); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  // Trainer:in direkt am Termin ein- oder austeilen (ohne Neuladen).
  async function toggle(e: CalendarEntry, trainerId: string, on: boolean) {
    const res = on
      ? await supabase
          .from("course_session_assignments")
          .insert({ session_id: e.id, trainer_id: trainerId })
      : await supabase
          .from("course_session_assignments")
          .delete()
          .eq("session_id", e.id)
          .eq("trainer_id", trainerId);
    if (res.error) return toast.error(res.error.message);
    const name = trainers.find((t) => t.id === trainerId)?.name ?? "Unbekannt";
    setEntries((prev) =>
      prev.map((x) => {
        if (x.kind !== "session" || x.id !== e.id) return x;
        const assigned = new Set(x.assignedIds ?? []);
        const tr = x.trainers.filter((t) => t.id !== trainerId);
        if (on) {
          assigned.add(trainerId);
          tr.push({ id: trainerId, name });
        } else assigned.delete(trainerId);
        return { ...x, assignedIds: [...assigned], trainers: tr };
      }),
    );
    toast.success(on ? `${name} eingeteilt` : `${name} ausgeteilt`);
  }

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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (kind !== "all" && e.kind !== kind) return false;
      if (scope === "upcoming" && e.date < today) return false;
      if (onlyOpen && !(e.kind === "session" && e.trainers.length < need(e))) return false;
      if (!needle) return true;
      const hay = [
        e.title,
        e.subtitle ?? "",
        e.location ?? "",
        ...e.trainers.map((t) => t.name),
        ...e.helpers,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [entries, kind, scope, q, today, onlyOpen]);

  const byMonth = useMemo(() => {
    const map = new Map<string, Map<string, CalendarEntry[]>>();
    filtered.forEach((e) => {
      const mk = monthKey(e.date);
      const days = map.get(mk) ?? new Map<string, CalendarEntry[]>();
      days.set(e.date, [...(days.get(e.date) ?? []), e]);
      map.set(mk, days);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const byCourse = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    filtered.forEach((e) => {
      if (e.kind !== "session" || !e.courseId) return;
      if (focusCourse && e.courseId !== focusCourse) return;
      map.set(e.courseId, [...(map.get(e.courseId) ?? []), e]);
    });
    return [...map.entries()]
      .map(([k, l]) => [k, l.sort((a, b) => a.date.localeCompare(b.date))] as const)
      .sort((a, b) => a[1][0].date.localeCompare(b[1][0].date));
  }, [filtered, focusCourse]);

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

  const openHelperSlots = filtered.reduce(
    (sum, e) => sum + e.helperNeed.reduce((s, g) => s + Math.max(0, g.needed - g.filled), 0),
    0,
  );
  const withoutTrainer = filtered.filter(
    (e) => e.kind === "session" && e.trainers.length === 0,
  ).length;
  const understaffed = filtered.filter(
    (e) => e.kind === "session" && e.trainers.length > 0 && e.trainers.length < need(e),
  ).length;
  const withoutTime = filtered.filter((e) => !e.startTime).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" /> Kurskalender &amp; Dienstplan
          </h1>
          <p className="text-sm text-muted-foreground">
            Dienstplan: Trainer:innen direkt am Termin einteilen. Nur Eingeteilte sehen den Kurs im
            Trainerbereich.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Aktualisieren
        </Button>
      </div>

      {(withoutTrainer > 0 || understaffed > 0) && (
        <div className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-3 text-sm">
          ⚠️{" "}
          {withoutTrainer > 0 && (
            <>
              <b>{withoutTrainer}</b> Termin(e) ohne Trainer:in
            </>
          )}
          {withoutTrainer > 0 && understaffed > 0 && " · "}
          {understaffed > 0 && (
            <>
              <b>{understaffed}</b> Termin(e) mit zu wenigen Trainer:innen
            </>
          )}
          {!onlyOpen && (
            <Button size="sm" variant="outline" className="ml-3" onClick={() => setOnlyOpen(true)}>
              Nur diese anzeigen
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{filtered.length}</div>
            <div className="text-xs text-muted-foreground">Termine im Zeitraum</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{withoutTrainer}</div>
            <div className="text-xs text-muted-foreground">Kurstermine ohne Trainer:in</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{openHelperSlots}</div>
            <div className="text-xs text-muted-foreground">Offene Helferplätze</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5">
          <Button
            size="sm"
            variant={view === "course" ? "default" : "ghost"}
            onClick={() => setView("course")}
          >
            Nach Kursen
          </Button>
          <Button
            size="sm"
            variant={view === "date" ? "default" : "ghost"}
            onClick={() => setView("date")}
          >
            Nach Terminen
          </Button>
        </div>
        {focusCourse && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setFocusCourse(null);
              window.history.replaceState(null, "", "/admin/kalender");
            }}
          >
            Nur ein Kurs – alle zeigen
          </Button>
        )}
        <Select value={scope} onValueChange={(v: "upcoming" | "all") => setScope(v)}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Ab heute</SelectItem>
            <SelectItem value="all">Alle Termine</SelectItem>
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={(v: "all" | "session" | "event") => setKind(v)}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Kurse & Vereinstermine</SelectItem>
            <SelectItem value="session">Nur Kurstermine</SelectItem>
            <SelectItem value="event">Nur Vereinstermine</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={onlyOpen ? "default" : "outline"}
          onClick={() => setOnlyOpen((v) => !v)}
        >
          Nur unvollständig besetzte
        </Button>
        <Input
          className="w-64"
          placeholder="Suche (Kurs, Ort, Person)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {withoutTime > 0 && (
          <span className="text-xs text-muted-foreground">
            {withoutTime} Termin(e) ohne Uhrzeit – Uhrzeit unter „Kurse → Termine“ eintragen.
          </span>
        )}
      </div>

      {loading && <div className="text-sm text-muted-foreground">Kalender wird geladen…</div>}
      {!loading && (view === "date" ? byMonth.length === 0 : byCourse.length === 0) && (
        <div className="text-sm text-muted-foreground">Keine Termine gefunden.</div>
      )}

      {view === "course" &&
        byCourse.map(([cid, list]) => {
          const incomplete = list.filter((s) => (s.assignedIds ?? []).length < need(s)).length;
          return (
            <CollapsibleCard
              key={cid}
              storageKey={`cal-course-${cid}`}
              title={list[0].title}
              subtitle={`${list.length} Termin(e) · ${shortDate(list[0].date)} – ${shortDate(list[list.length - 1].date)}${list[0].location ? ` · ${list[0].location}` : ""}${incomplete ? ` · ⚠️ ${incomplete} unvollständig` : " · ✓ besetzt"}`}
            >
              <CourseRosterMatrix sessions={list} trainers={trainers} onChanged={applyChange} />
            </CollapsibleCard>
          );
        })}

      {view === "date" &&
        byMonth.map(([mk, days]) => (
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
                            <Badge variant={e.kind === "session" ? "secondary" : "outline"}>
                              {e.kind === "session" ? "Kurstermin" : "Vereinstermin"}
                            </Badge>
                            {e.location && (
                              <span className="text-xs text-muted-foreground">{e.location}</span>
                            )}
                          </div>
                          {e.subtitle && (
                            <div className="mt-1 text-xs text-muted-foreground">{e.subtitle}</div>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                            {e.kind === "session" && (
                              <SessionRoster
                                e={e}
                                trainers={trainers}
                                open={picker === e.id}
                                setOpen={(v) => setPicker(v ? e.id : null)}
                                onToggle={toggle}
                              />
                            )}
                            {(e.helpers.length > 0 || e.helperNeed.length > 0) && (
                              <span className="flex items-center gap-1">
                                <HandHelping className="h-3.5 w-3.5" />
                                {e.helpers.length > 0 ? e.helpers.join(", ") : "noch keine Zusagen"}
                              </span>
                            )}
                            {e.helperNeed.map((g) => (
                              <Badge
                                key={g.name}
                                variant={g.filled >= g.needed ? "secondary" : "outline"}
                                className={
                                  g.filled >= g.needed ? "" : "border-destructive text-destructive"
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
    </div>
  );
}

function SessionRoster({
  e,
  trainers,
  open,
  setOpen,
  onToggle,
}: {
  e: CalendarEntry;
  trainers: { id: string; name: string }[];
  open: boolean;
  setOpen: (v: boolean) => void;
  onToggle: (e: CalendarEntry, id: string, on: boolean) => void;
}) {
  const n = e.trainers.length;
  const required = need(e);
  const light = n === 0 ? "🔴" : n < required ? "🟡" : "🟢";
  const assigned = new Set(e.assignedIds ?? []);
  const av = new Map((e.availability ?? []).map((a) => [a.id, a.available]));
  const rank = (id: string) => (av.get(id) === true ? 0 : av.get(id) === false ? 2 : 1);
  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span title="Besetzung">{light}</span>
        <Users className="h-3.5 w-3.5" />
        <span className={n < required ? "font-medium text-destructive" : "text-muted-foreground"}>
          {n} von {required}
        </span>
        {n === 0 && <span className="text-destructive">keine Trainer:in eingeteilt</span>}
        {e.trainers.map((t) => (
          <Badge key={t.id} variant="secondary" className="gap-1">
            {t.name}
            {assigned.has(t.id) && (
              <button
                type="button"
                aria-label={`${t.name} austeilen`}
                onClick={() => onToggle(e, t.id, false)}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
        <Button size="sm" variant="outline" className="h-7" onClick={() => setOpen(!open)}>
          <Plus className="h-3.5 w-3.5" /> Trainer einteilen
        </Button>
        {e.courseId && (
          <Link to="/admin/kurse" className="text-primary underline-offset-2 hover:underline">
            Zur Kursakte
          </Link>
        )}
      </div>
      {open && (
        <div className="rounded-md border bg-muted/30 p-2">
          <div className="mb-1 text-muted-foreground">
            🟢 kann · ⚪ keine Rückmeldung · 🔴 kann nicht – Klick teilt ein bzw. aus
          </div>
          <div className="flex flex-wrap gap-1.5">
            {trainers
              .slice()
              .sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name, "de"))
              .map((t) => {
                const on = assigned.has(t.id);
                const dot = av.get(t.id) === true ? "🟢" : av.get(t.id) === false ? "🔴" : "⚪";
                return (
                  <Button
                    key={t.id}
                    size="sm"
                    variant={on ? "default" : "outline"}
                    className="h-7"
                    onClick={() => onToggle(e, t.id, !on)}
                  >
                    {dot} {t.name}
                  </Button>
                );
              })}
            {trainers.length === 0 && (
              <span className="text-muted-foreground">Keine Trainer gefunden</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
