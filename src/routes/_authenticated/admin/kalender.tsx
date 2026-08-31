import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { listAdminCalendar, type CalendarEntry } from "@/lib/calendar.functions";
import { CalendarDays, RefreshCw, Users, HandHelping } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/kalender")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/admin-guard.functions");
    const { redirect } = await import("@tanstack/react-router");
    try { await assertHasAnyRole({ data: { roles: ["admin", "board"] } }); }
    catch { throw redirect({ to: "/admin/benutzer" }); }
  },
  head: () => ({ meta: [{ title: "Kurskalender – Verwaltung" }] }),
  component: Page,
});

const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
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

function Page() {
  const load = useServerFn(listAdminCalendar);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<"all" | "session" | "event">("all");
  const [scope, setScope] = useState<"upcoming" | "all">("upcoming");
  const [q, setQ] = useState("");

  async function refresh() {
    setLoading(true);
    try { setEntries(await load()); } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const today = useMemo(
    () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date()),
    [],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (kind !== "all" && e.kind !== kind) return false;
      if (scope === "upcoming" && e.date < today) return false;
      if (!needle) return true;
      const hay = [
        e.title, e.subtitle ?? "", e.location ?? "",
        ...e.trainers.map((t) => t.name), ...e.helpers,
      ].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [entries, kind, scope, q, today]);

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

  const openHelperSlots = filtered.reduce(
    (sum, e) => sum + e.helperNeed.reduce((s, g) => s + Math.max(0, g.needed - g.filled), 0),
    0,
  );
  const withoutTrainer = filtered.filter((e) => e.kind === "session" && e.trainers.length === 0).length;
  const withoutTime = filtered.filter((e) => !e.startTime).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" /> Kurskalender
          </h1>
          <p className="text-sm text-muted-foreground">
            Alle Kurstermine und Vereinstermine mit Datum, Uhrzeit, eingeteilten Trainer:innen und Helfer:innen (Zeiten in Europe/Berlin).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Aktualisieren
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="pt-4">
          <div className="text-2xl font-bold">{filtered.length}</div>
          <div className="text-xs text-muted-foreground">Termine im Zeitraum</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-2xl font-bold">{withoutTrainer}</div>
          <div className="text-xs text-muted-foreground">Kurstermine ohne Trainer:in</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-2xl font-bold">{openHelperSlots}</div>
          <div className="text-xs text-muted-foreground">Offene Helferplätze</div>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={scope} onValueChange={(v: "upcoming" | "all") => setScope(v)}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Ab heute</SelectItem>
            <SelectItem value="all">Alle Termine</SelectItem>
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={(v: "all" | "session" | "event") => setKind(v)}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Kurse & Vereinstermine</SelectItem>
            <SelectItem value="session">Nur Kurstermine</SelectItem>
            <SelectItem value="event">Nur Vereinstermine</SelectItem>
          </SelectContent>
        </Select>
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
      {!loading && byMonth.length === 0 && (
        <div className="text-sm text-muted-foreground">Keine Termine gefunden.</div>
      )}

      {byMonth.map(([mk, days]) => (
        <CollapsibleCard
          key={mk}
          storageKey={`cal-${mk}`}
          title={fmtMonth(mk)}
          description={`${[...days.values()].reduce((s, l) => s + l.length, 0)} Termin(e)`}
        >
          <div className="space-y-4">
            {[...days.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, list]) => (
              <div key={day}>
                <div className="mb-2 text-sm font-semibold">
                  {fmtDay(day)}
                  {day === today && <Badge className="ml-2">heute</Badge>}
                </div>
                <div className="space-y-2">
                  {list.map((e) => (
                    <div key={`${e.kind}-${e.id}`} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-32 shrink-0 text-sm font-medium tabular-nums">{timeLabel(e)}</span>
                        <span className="font-medium">{e.title}</span>
                        <Badge variant={e.kind === "session" ? "secondary" : "outline"}>
                          {e.kind === "session" ? "Kurstermin" : "Vereinstermin"}
                        </Badge>
                        {e.location && <span className="text-xs text-muted-foreground">{e.location}</span>}
                      </div>
                      {e.subtitle && <div className="mt-1 text-xs text-muted-foreground">{e.subtitle}</div>}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        {e.kind === "session" && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {e.trainers.length > 0
                              ? e.trainers.map((t) => t.name).join(", ")
                              : <span className="text-destructive">keine Trainer:in eingeteilt</span>}
                          </span>
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
                            className={g.filled >= g.needed ? "" : "border-destructive text-destructive"}
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
