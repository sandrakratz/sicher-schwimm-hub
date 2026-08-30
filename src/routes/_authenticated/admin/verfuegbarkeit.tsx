import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listTrainers, type TrainerOption } from "@/lib/trainers.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, CalendarDays, MapPin, Clock, CalendarPlus } from "lucide-react";
import { formatDateBerlin } from "@/lib/format";
import { buildIcs, googleCalendarUrl, icsDate, parseTimeRange, type CalendarItem } from "@/lib/ics";

export const Route = createFileRoute("/_authenticated/admin/verfuegbarkeit")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/admin-guard.functions");
    const { redirect } = await import("@tanstack/react-router");
    try { await assertHasAnyRole({ data: { roles: ["admin", "board", "trainer"] } }); }
    catch { throw redirect({ to: "/portal" }); }
  },
  head: () => ({
    meta: [
      { title: "Verfügbarkeit & Einteilung – Adminbereich | Sicher Schwimmen e.V." },
      { name: "description", content: "Trainer-Verfügbarkeiten für Kurstermine erfassen und Einteilungen verwalten." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AvailabilityPage,
});

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



function AvailabilityPage() {
  const [me, setMe] = useState<string>("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [courses, setCourses] = useState<Record<string, CourseRow>>({});
  const [avail, setAvail] = useState<Avail[]>([]);
  const [assign, setAssign] = useState<Assign[]>([]);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

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
      .map(s => {
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
    const dates = t
      ? `${berlinToUtcStamp(s.session_date, t.start)}/${berlinToUtcStamp(s.session_date, t.end)}`
      : `${icsDate(s.session_date)}/${icsDate(s.session_date, 1)}`;
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: `${c?.name || "Kurstermin"} (${s.session_index}. Termin)`,
      dates,
      details: c?.schedule ? `Zeitplan: ${c.schedule}` : "",
      location: c?.location || "",
      ctz: "Europe/Berlin",
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
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

      {loading ? (
        <Card className="border-0 shadow-soft"><CardContent className="py-10 text-center text-muted-foreground">Wird geladen …</CardContent></Card>
      ) : groups.length === 0 ? (
        <Card className="border-0 shadow-soft"><CardContent className="py-10 text-center text-muted-foreground">Es sind keine kommenden Kurstermine hinterlegt.</CardContent></Card>
      ) : (
        <div className="space-y-6">
          {groups.map(g => (
            <Card key={g.courseId} className="border-0 shadow-soft">
              <CardContent className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display text-lg font-semibold text-primary-deep">{g.course?.name || "Kurs"}</div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {g.course?.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{g.course.location}</span>}
                      {g.course?.schedule && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{g.course.schedule}</span>}
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{g.sessions.length} Termine</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={busy === g.courseId} onClick={() => setAll(g.courseId, true)}>Alle: Kann</Button>
                    <Button size="sm" variant="outline" disabled={busy === g.courseId} onClick={() => setAll(g.courseId, false)}>Alle: Kann nicht</Button>
                  </div>
                </div>

                <div className="divide-y rounded-md border">
                  {g.sessions.map(s => {
                    const state = myState(s.id);
                    const yes = avail.filter(a => a.session_id === s.id && a.available).map(a => trainerName(a.trainer_id));
                    const assignedIds = assign.filter(a => a.session_id === s.id).map(a => a.trainer_id);
                    const assignedToMe = assignedIds.includes(me);
                    const others = assignedIds.filter(id => id !== me).map(trainerName);
                    return (
                      <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">
                            {s.session_index}. Termin · {weekday(s.session_date)}, {formatDateBerlin(s.session_date)}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {assignedToMe && <Badge className="border-transparent bg-primary text-primary-foreground">Du bist eingeteilt</Badge>}
                            {others.length > 0 && <span>Eingeteilt: {others.join(", ")}</span>}

                            <span>Zusagen: {yes.length > 0 ? yes.join(", ") : "noch keine"}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={googleLink(s)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary underline hover:text-primary-deep"
                            title="Diesen Termin in Google Kalender eintragen"
                          >
                            Google
                          </a>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === s.id}
                            onClick={() => setAvailability(s.id, state === true ? null : true)}
                            className={state === true ? "border-transparent bg-green-600 text-white hover:bg-green-700" : ""}
                          >
                            <Check className="h-4 w-4" /> Kann
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === s.id}
                            onClick={() => setAvailability(s.id, state === false ? null : false)}
                            className={state === false ? "border-transparent bg-red-600 text-white hover:bg-red-700" : ""}
                          >
                            <X className="h-4 w-4" /> Kann nicht
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
