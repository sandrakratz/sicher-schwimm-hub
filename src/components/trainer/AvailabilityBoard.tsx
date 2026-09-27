import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listTrainers, type TrainerOption } from "@/lib/trainers.functions";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, CalendarDays, MapPin, Clock, CalendarPlus, AlertTriangle, List, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateBerlin } from "@/lib/format";
import { buildIcs, googleCalendarUrl, parseTimeRange, type CalendarItem } from "@/lib/ics";
import { EventShiftSignups } from "@/components/admin/EventShiftSignups";


type SessionRow = {
  id: string;
  course_id: string;
  session_index: number;
  session_date: string;
  assigned_trainer_id: string | null;
};

type CourseRow = { id: string; name: string; location: string | null; schedule: string | null; duration: string | null };

type Avail = { session_id: string; trainer_id: string; available: boolean };

type Assign = { session_id: string; trainer_id: string };

function weekday(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: "Europe/Berlin" }).format(d);
}

// Kalenderlogik (ICS, Zeiten, Google-Links) liegt zentral in @/lib/ics.



export function AvailabilityBoard() {
  const [me, setMe] = useState<string>("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [courses, setCourses] = useState<Record<string, CourseRow>>({});
  const [avail, setAvail] = useState<Avail[]>([]);
  const [assign, setAssign] = useState<Assign[]>([]);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [showDeclined, setShowDeclined] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [month, setMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  const trainersFn = useServerFn(listTrainers);

  async function load() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    setMe(userData.user?.id || "");

    const today = new Date().toISOString().slice(0, 10);
    const { data: ss } = await supabase
      .from("course_sessions")
      .select("id,course_id,session_index,session_date,assigned_trainer_id")
      .gte("session_date", today)
      .order("session_date", { ascending: true });
    const sessionRows = (ss as SessionRow[]) || [];
    setSessions(sessionRows);

    const { data: cs } = await supabase.from("courses").select("id,name,location,schedule,duration");
    const map: Record<string, CourseRow> = {};
    for (const c of (cs as CourseRow[]) || []) map[c.id] = c;
    setCourses(map);

    if (sessionRows.length > 0) {
      const { data: av } = await supabase
        .from("course_session_availability")
        .select("session_id,trainer_id,available")
        .in("session_id", sessionRows.map(s => s.id));
      setAvail((av as Avail[]) || []);
      const { data: asg } = await supabase
        .from("course_session_assignments")
        .select("session_id,trainer_id")
        .in("session_id", sessionRows.map(s => s.id));
      setAssign((asg as Assign[]) || []);
    } else {
      setAvail([]);
      setAssign([]);
    }


    try { setTrainers(await trainersFn()); } catch { /* Namen optional */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const trainerName = (id: string | null | undefined) =>
    (id && trainers.find(t => t.id === id)?.name) || "Unbekannt";

  const groups = useMemo(() => {
    const byCourse = new Map<string, SessionRow[]>();
    for (const s of sessions) {
      const list = byCourse.get(s.course_id) || [];
      list.push(s);
      byCourse.set(s.course_id, list);
    }
    return Array.from(byCourse.entries())
      .map(([courseId, list]) => ({
        courseId,
        course: courses[courseId],
        sessions: list.slice().sort((a, b) => a.session_date.localeCompare(b.session_date)),
      }))
      .sort((a, b) => (a.sessions[0]?.session_date || "").localeCompare(b.sessions[0]?.session_date || ""));
  }, [sessions, courses]);

  function myState(sessionId: string): boolean | null {
    const row = avail.find(a => a.session_id === sessionId && a.trainer_id === me);
    return row ? row.available : null;
  }

  async function setAvailability(sessionId: string, value: boolean | null) {
    if (!me) return;
    setBusy(sessionId);
    if (value === null) {
      const { error } = await supabase
        .from("course_session_availability")
        .delete()
        .eq("session_id", sessionId)
        .eq("trainer_id", me);
      setBusy(null);
      if (error) { toast.error(error.message); return; }
      setAvail(a => a.filter(x => !(x.session_id === sessionId && x.trainer_id === me)));
      return;
    }
    const { error } = await supabase
      .from("course_session_availability")
      .upsert({ session_id: sessionId, trainer_id: me, available: value }, { onConflict: "session_id,trainer_id" });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    setAvail(a => {
      const rest = a.filter(x => !(x.session_id === sessionId && x.trainer_id === me));
      return [...rest, { session_id: sessionId, trainer_id: me, available: value }];
    });
  }

  async function setAll(courseId: string, value: boolean) {
    if (!me) return;
    const ids = sessions.filter(s => s.course_id === courseId).map(s => s.id);
    if (ids.length === 0) return;
    setBusy(courseId);
    const { error } = await supabase
      .from("course_session_availability")
      .upsert(ids.map(id => ({ session_id: id, trainer_id: me, available: value })), { onConflict: "session_id,trainer_id" });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    setAvail(a => {
      const rest = a.filter(x => !(x.trainer_id === me && ids.includes(x.session_id)));
      return [...rest, ...ids.map(id => ({ session_id: id, trainer_id: me, available: value }))];
    });
    toast.success(value ? "Für alle Termine zugesagt" : "Für alle Termine abgesagt");
  }

  function exportIcs(mode: "available" | "assigned") {
    const items = sessions
      .filter(s => mode === "available"
        ? avail.some(a => a.session_id === s.id && a.trainer_id === me && a.available)
        : assign.some(a => a.session_id === s.id && a.trainer_id === me))
      .map<CalendarItem>(s => {
        const c = courses[s.course_id];
        const t = parseTimeRange(c?.schedule, c?.duration);
        return {
          id: `${s.id}-${mode}`,
          date: s.session_date,
          start: t?.start ?? null,
          end: t?.end ?? null,
          title: `${c?.name || "Kurstermin"} (${s.session_index}. Termin)`,
          location: c?.location || "",
          description: [c?.schedule && `Zeitplan: ${c.schedule}`, mode === "assigned" ? "Du bist eingeteilt." : "Du hast zugesagt."]
            .filter(Boolean).join("\n"),
        };
      });
    if (items.length === 0) {
      toast.error(mode === "available" ? "Keine zugesagten Termine vorhanden." : "Keine Einteilungen vorhanden.");
      return;
    }
    const blob = new Blob([buildIcs(items)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = mode === "available" ? "sicher-schwimmen-zusagen.ics" : "sicher-schwimmen-einteilungen.ics";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(`${items.length} Termine als Kalenderdatei exportiert`);
  }

  function googleLink(s: SessionRow): string {
    const c = courses[s.course_id];
    const t = parseTimeRange(c?.schedule, c?.duration);
    return googleCalendarUrl({
      id: s.id,
      date: s.session_date,
      start: t?.start ?? null,
      end: t?.end ?? null,
      title: `${c?.name || "Kurstermin"} (${s.session_index}. Termin)`,
      location: c?.location || "",
      description: c?.schedule ? `Zeitplan: ${c.schedule}` : "",
    });
  }

  const isAssignedToMe = (id: string) => assign.some(a => a.session_id === id && a.trainer_id === me);
  const isVisible = (s: SessionRow) => showDeclined || isAssignedToMe(s.id) || myState(s.id) !== false;
  const staffCount = (id: string) => new Set([
    ...avail.filter(a => a.session_id === id && a.available).map(a => a.trainer_id),
    ...assign.filter(a => a.session_id === id).map(a => a.trainer_id),
  ]).size;
  const understaffed = sessions.filter(s => staffCount(s.id) < 2);
  const visibleSessions = sessions.filter(isVisible);
  const byDate = new Map<string, SessionRow[]>();
  for (const s of visibleSessions) {
    const l = byDate.get(s.session_date) || [];
    l.push(s);
    byDate.set(s.session_date, l);
  }
  const monthCells: (string | null)[] = (() => {
    const first = new Date(month.y, month.m, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(month.y, month.m + 1, 0).getDate();
    const cells: (string | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= days; d++) {
      cells.push(`${month.y}-${String(month.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    return cells;
  })();
  function shiftMonth(delta: number) {
    setSelectedDate(null);
    setMonth(({ y, m }) => { const d = new Date(y, m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  }
  function statusDot(s: SessionRow) {
    if (isAssignedToMe(s.id)) return "bg-primary";
    const st = myState(s.id);
    if (st === true) return "bg-green-600";
    if (st === false) return "bg-muted-foreground/40";
    return "bg-amber-400";
  }

  function renderSession(s: SessionRow, opts: { compact?: boolean } = {}) {
    const c = courses[s.course_id];
    const state = myState(s.id);
    const yes = avail.filter(a => a.session_id === s.id && a.available).map(a => trainerName(a.trainer_id));
    const assignedIds = assign.filter(a => a.session_id === s.id).map(a => a.trainer_id);
    const assignedToMe = assignedIds.includes(me);
    const others = assignedIds.filter(id => id !== me).map(trainerName);
    const count = staffCount(s.id);
    return (
      <div key={s.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium">
            {weekday(s.session_date)}, {formatDateBerlin(s.session_date)} · {c?.name || "Kurs"} ({s.session_index}. Termin)
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {c?.schedule && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{c.schedule}</span>}
            {c?.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{c.location}</span>}
            {assignedToMe && <Badge className="border-transparent bg-primary text-primary-foreground">Du bist eingeteilt</Badge>}
            {others.length > 0 && <span>Eingeteilt: {others.join(", ")}</span>}
            {!opts.compact && <span>Zusagen: {yes.length > 0 ? yes.join(", ") : "noch keine"}</span>}
            {count < 2 && <span className="font-medium text-destructive">{count} von 2 Trainern</span>}
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {!opts.compact && (
            <a href={googleLink(s)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline hover:text-primary-deep" title="Diesen Termin in Google Kalender eintragen">Google</a>
          )}
          <Button size="sm" variant="outline" disabled={busy === s.id}
            onClick={() => setAvailability(s.id, state === true ? null : true)}
            className={`min-h-11 flex-1 sm:flex-none ${state === true ? "border-transparent bg-green-600 text-white hover:bg-green-700" : ""}`}>
            <Check className="h-4 w-4" /> {opts.compact && state !== true ? "Ich springe ein" : "Kann"}
          </Button>
          {!opts.compact && (
            <Button size="sm" variant="outline" disabled={busy === s.id}
              onClick={() => setAvailability(s.id, state === false ? null : false)}
              className={`min-h-11 flex-1 sm:flex-none ${state === false ? "border-transparent bg-red-600 text-white hover:bg-red-700" : ""}`}>
              <X className="h-4 w-4" /> Kann nicht
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl font-bold text-primary-deep mb-2">Meine Verfügbarkeit</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Bitte pro Kurstermin angeben, ob du kannst. Ein erneuter Klick auf die gewählte Antwort hebt sie wieder auf.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => exportIcs("available")}>
          <CalendarPlus className="h-4 w-4" /> Zusagen als Kalender (.ics)
        </Button>
        <Button size="sm" variant="outline" onClick={() => exportIcs("assigned")}>
          <CalendarPlus className="h-4 w-4" /> Meine Einteilungen (.ics)
        </Button>
        <span className="text-xs text-muted-foreground">
          Die .ics-Datei kannst du in Google Kalender (Einstellungen → Importieren) und in familywall.com importieren.
        </span>
      </div>

      {me && <EventShiftSignups me={me} trainers={trainers} />}

      <h2 className="font-display text-2xl font-bold text-primary-deep mb-3">Kurstermine</h2>

      {!loading && understaffed.length > 0 && (
        <Card className="mb-6 border-2 border-destructive/40 bg-destructive/5 shadow-soft">
          <CardContent className="py-4">
            <div className="mb-3 flex items-center gap-2 font-semibold text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Bei {understaffed.length} {understaffed.length === 1 ? "Termin fehlen" : "Terminen fehlen"} noch Trainer (weniger als 2 Zusagen)
            </div>
            <div className="divide-y rounded-md border bg-background">
              {understaffed.slice(0, 6).map(s => renderSession(s, { compact: true }))}
            </div>
            {understaffed.length > 6 && (
              <p className="mt-2 text-xs text-muted-foreground">… und {understaffed.length - 6} weitere.</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5">
          <Button size="sm" variant={view === "calendar" ? "default" : "ghost"} onClick={() => setView("calendar")}>
            <CalendarDays className="h-4 w-4" /> Kalender
          </Button>
          <Button size="sm" variant={view === "list" ? "default" : "ghost"} onClick={() => setView("list")}>
            <List className="h-4 w-4" /> Liste
          </Button>
        </div>
        <label className="ml-auto inline-flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showDeclined} onChange={e => setShowDeclined(e.target.checked)} />
          Abgesagte Termine einblenden
        </label>
      </div>

      {loading ? (
        <Card className="border-0 shadow-soft"><CardContent className="py-10 text-center text-muted-foreground">Wird geladen …</CardContent></Card>
      ) : visibleSessions.length === 0 ? (
        <Card className="border-0 shadow-soft"><CardContent className="py-10 text-center text-muted-foreground">Keine offenen oder zugesagten Kurstermine.</CardContent></Card>
      ) : view === "calendar" ? (
        <Card className="border-0 shadow-soft">
          <CardContent className="py-4">
            <div className="mb-3 flex items-center justify-between">
              <Button size="sm" variant="ghost" onClick={() => shiftMonth(-1)} aria-label="Vorheriger Monat"><ChevronLeft className="h-4 w-4" /></Button>
              <div className="font-semibold">
                {new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(new Date(month.y, month.m, 1))}
              </div>
              <Button size="sm" variant="ghost" onClick={() => shiftMonth(1)} aria-label="Nächster Monat"><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
              {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthCells.map((cell, i) => {
                if (!cell) return <div key={i} />;
                const list = byDate.get(cell) || [];
                const selected = selectedDate === cell;
                return (
                  <button
                    key={cell}
                    type="button"
                    disabled={list.length === 0}
                    onClick={() => setSelectedDate(selected ? null : cell)}
                    className={`min-h-14 rounded-md border p-1 text-left text-xs transition-colors ${list.length ? "hover:bg-muted" : "opacity-40"} ${selected ? "ring-2 ring-primary" : ""}`}
                  >
                    <div className="font-medium">{Number(cell.slice(8))}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {list.map(s => <span key={s.id} className={`h-2.5 w-2.5 rounded-full ${statusDot(s)}`} />)}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-primary" />Eingeteilt</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-600" />Zugesagt</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Offen</span>
              {showDeclined && <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />Abgesagt</span>}
            </div>
            {selectedDate && (byDate.get(selectedDate) || []).length > 0 && (
              <div className="mt-4 divide-y rounded-md border">
                {(byDate.get(selectedDate) || []).map(s => renderSession(s))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(g => {
            const list = g.sessions.filter(isVisible);
            if (list.length === 0) return null;
            return (
              <CollapsibleCard
                key={g.courseId}
                className="border-0 shadow-soft"
                storageKey={`trainer-avail-${g.courseId}`}
                title={g.course?.name || "Kurs"}
                subtitle={
                  <span className="flex flex-wrap gap-3">
                    {g.course?.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{g.course.location}</span>}
                    {g.course?.schedule && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{g.course.schedule}</span>}
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{list.length} Termine</span>
                  </span>
                }
                actions={
                  <>
                    <Button size="sm" variant="outline" disabled={busy === g.courseId} onClick={() => setAll(g.courseId, true)}>Alle: Kann</Button>
                    <Button size="sm" variant="outline" disabled={busy === g.courseId} onClick={() => setAll(g.courseId, false)}>Alle: Kann nicht</Button>
                  </>
                }
              >
                <div className="divide-y rounded-md border">
                  {list.map(s => renderSession(s))}
                </div>
              </CollapsibleCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
