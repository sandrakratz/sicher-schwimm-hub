import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarCheck, CalendarDays, MapPin } from "lucide-react";
import { formatDateBerlin, todayBerlinIso } from "@/lib/format";
import { fetchAll, fetchIn } from "@/lib/fetch-all";
import { OpenAvailabilityNotice } from "@/components/OpenAvailabilityNotice";
import { getMyPayoutDetails } from "@/lib/trainer-payout.functions";
import { WeekShifts } from "@/components/trainer/WeekShifts";
import { InstallHint } from "@/components/trainer/InstallHint";
import { DeviceCard } from "@/components/trainer/DeviceCard";
import { Qualifications } from "@/components/trainer/Qualifications";
import { MyPayouts } from "@/components/trainer/MyPayouts";

export const Route = createFileRoute("/_authenticated/trainer/")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board", "trainer"] } });
    } catch {
      throw redirect({ to: "/portal" });
    }
  },
  head: () => ({
    meta: [
      { title: "Trainerbereich | Sicher Schwimmen e.V." },
      {
        name: "description",
        content: "Eigene Kurstermine, Einteilungen und Helfer-Einsätze auf einen Blick.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TrainerHome,
});

type Row = {
  id: string;
  session_date: string;
  session_index: number;
  start_time: string | null;
  end_time: string | null;
  courseId: string;
  course: {
    name: string;
    location: string | null;
    schedule: string | null;
    trainer_id: string | null;
  } | null;
};

type DoneRow = {
  sessionId: string;
  date: string;
  sessionIndex: number;
  startTime: string | null;
  endTime: string | null;
  courseName: string;
};

function TrainerHome() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState("");
  // Vom Vorstand bestätigte Anwesenheiten (Termin-ID → Datum), auch bei Ersatz-Einsätzen
  const [confirmed, setConfirmed] = useState<DoneRow[]>([]);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user?.id;
      setMe(me ?? "");
      if (!me) {
        setLoading(false);
        return;
      }

      // Nur die eigenen Einsätze laden (nicht alle Termine des Vereins; Supabase liefert pro Abfrage höchstens
      // 1000 Zeilen). Wie unter „Meine Kurse“ zählen auch Kurse, in denen man als Kurstrainer:in eingetragen ist.
      const SELECT =
        "id,course_id,session_date,session_index,start_time,end_time,assigned_trainer_id,courses(name,location,schedule,trainer_id,archived_at)";
      const assignments = await fetchAll<{ session_id: string }>((f, t) =>
        supabase
          .from("course_session_assignments")
          .select("session_id")
          .eq("trainer_id", me)
          .order("id")
          .range(f, t),
      );
      const ownCourses = await fetchAll<{ id: string }>((f, t) =>
        supabase.from("courses").select("id").eq("trainer_id", me).order("id").range(f, t),
      );
      const [byAssignment, byTerm, byCourse] = await Promise.all([
        fetchIn<any>(
          assignments.map((a) => a.session_id),
          (chunk, f, t) =>
            supabase.from("course_sessions").select(SELECT).in("id", chunk).order("id").range(f, t),
        ),
        fetchAll<any>((f, t) =>
          supabase
            .from("course_sessions")
            .select(SELECT)
            .eq("assigned_trainer_id", me)
            .order("id")
            .range(f, t),
        ),
        fetchIn<any>(
          ownCourses.map((c) => c.id),
          (chunk, f, t) =>
            supabase
              .from("course_sessions")
              .select(SELECT)
              .in("course_id", chunk)
              .order("id")
              .range(f, t),
        ),
      ]);
      const att = await fetchAll<any>((f, t) =>
        supabase
          .from("trainer_session_attendance")
          .select(
            "id,session_id,course_sessions(session_date,session_index,start_time,end_time,courses(name,archived_at))",
          )
          .eq("trainer_id", me)
          .eq("present", true)
          .not("confirmed_at", "is", null)
          .order("id")
          .range(f, t),
      );
      setConfirmed(
        att
          .filter((a) => a.course_sessions && !a.course_sessions.courses?.archived_at)
          .map((a) => ({
            sessionId: a.session_id,
            date: a.course_sessions.session_date,
            sessionIndex: a.course_sessions.session_index,
            startTime: a.course_sessions.start_time ?? null,
            endTime: a.course_sessions.end_time ?? null,
            courseName: a.course_sessions.courses?.name ?? "Kurs",
          })),
      );
      const byId = new Map<string, any>();
      for (const s of [...byAssignment, ...byTerm, ...byCourse]) byId.set(s.id, s);
      // Abgesagte (archivierte) Kurse nicht anzeigen
      const mine = [...byId.values()]
        .filter((s) => !s.courses?.archived_at)
        .sort(
          (a, b) =>
            a.session_date.localeCompare(b.session_date) || a.session_index - b.session_index,
        );
      setRows(
        mine.map((s) => ({
          id: s.id,
          session_date: s.session_date,
          session_index: s.session_index,
          start_time: s.start_time ?? null,
          end_time: s.end_time ?? null,
          courseId: s.course_id,
          course: s.courses ?? null,
        })),
      );
      setLoading(false);
    })();
  }, []);

  const today = todayBerlinIso();
  const upcoming = useMemo(() => rows.filter((r) => r.session_date >= today), [rows, today]);
  const currentYear = String(new Date().getFullYear());
  const done = useMemo(
    () =>
      confirmed
        .filter((c) => c.date <= today)
        .sort((a, b) => b.date.localeCompare(a.date) || b.sessionIndex - a.sessionIndex),
    [confirmed, today],
  );
  const thisYear = useMemo(
    () => rows.filter((r) => r.session_date.startsWith(currentYear)),
    [rows, currentYear],
  );

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; rows: Row[] }>();
    for (const r of upcoming) {
      const key = r.courseId || "sonstige";
      const g = map.get(key) ?? { name: r.course?.name ?? "Kurs", rows: [] };
      g.rows.push(r);
      map.set(key, g);
    }
    return Array.from(map.entries());
  }, [upcoming]);

  const next = upcoming[0];
  const todayRows = upcoming.filter((r) => r.session_date === today);

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="font-display text-2xl font-bold text-primary-deep sm:text-3xl">
        Trainerbereich
      </h1>

      <OpenAvailabilityNotice />
      <PayoutIbanNotice />

      <WeekShifts rows={upcoming} me={me} today={today} loading={loading} />

      <InstallHint />

      {me && <DeviceCard rows={upcoming} me={me} loading={loading} />}

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Einsätze gesamt" value={rows.length} />
        <StatCard label="Noch anstehend" value={upcoming.length} />
      </div>

      <CollapsibleCard
        storageKey="trainer-home-stats"
        defaultOpen={false}
        className="border-0 shadow-soft"
        title="Weitere Zahlen für die Abrechnung"
      >
        <div className="grid grid-cols-2 gap-3">
          <StatCard label={`Einsätze ${currentYear}`} value={thisYear.length} />
          <StatCard
            label="Bereits geleistet (Liste anzeigen)"
            value={done.length}
            onClick={() => setShowDone(true)}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          „Einsätze“ sind alle Kurstermine, für die du eingeteilt bist. „Bereits geleistet“ zählt
          nur Termine, bei denen der Vorstand deine Anwesenheit bestätigt hat.
        </p>
      </CollapsibleCard>

      <Dialog open={showDone} onOpenChange={setShowDone}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bereits geleistete Einsätze ({done.length})</DialogTitle>
            <DialogDescription>
              Termine, bei denen der Vorstand deine Anwesenheit bestätigt hat. Zum Nachprüfen bei
              der Abrechnung.
            </DialogDescription>
          </DialogHeader>
          {done.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Noch keine bestätigten Einsätze.
            </p>
          ) : (
            <div className="divide-y rounded-md border bg-card">
              {done.map((d) => (
                <div key={d.sessionId} className="p-3">
                  <div className="text-sm font-medium">
                    {d.courseName} <span className="font-normal">({d.sessionIndex}. Termin)</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {weekdayLabel(d.date)}, {formatDateBerlin(d.date)}
                    {timeLabel({ start_time: d.startTime, end_time: d.endTime })
                      ? ` · ${timeLabel({ start_time: d.startTime, end_time: d.endTime })}`
                      : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {me && <MyPayouts />}

      {me && <Qualifications me={me} />}

      <Link
        to="/trainer/verfuegbarkeit"
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-primary px-4 text-sm font-semibold text-primary sm:w-auto"
      >
        <CalendarCheck className="h-4 w-4" /> Verfügbarkeit &amp; Sperrzeiten
      </Link>

      <CollapsibleCard
        storageKey="trainer-home-all"
        defaultOpen={false}
        className="border-0 shadow-soft"
        title="Alle kommenden Einsätze nach Kurs"
        meta={<Badge variant="secondary">{upcoming.length}</Badge>}
      >
        {loading ? (
          <Card className="border-0 shadow-soft">
            <CardContent className="py-10 text-center text-muted-foreground">
              Wird geladen …
            </CardContent>
          </Card>
        ) : groups.length === 0 ? (
          <Card className="border-0 shadow-soft">
            <CardContent className="py-10 text-center text-muted-foreground">
              Aktuell bist du für keine kommenden Termine eingeteilt.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {groups.map(([courseId, g], i) => (
              <CollapsibleCard
                key={courseId}
                defaultOpen={i === 0}
                storageKey={`trainer-home-${courseId}`}
                className="border-0 shadow-soft"
                title={g.name}
                subtitle={g.rows[0]?.course?.schedule ?? undefined}
                meta={<Badge variant="secondary">{g.rows.length} Termine</Badge>}
              >
                <div className="divide-y rounded-md border bg-card">
                  {g.rows.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-3"
                    >
                      <div>
                        <div className="text-sm font-medium">{r.session_index}. Termin</div>
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {weekdayLabel(r.session_date)}, {formatDateBerlin(r.session_date)}
                          </span>
                          {r.course?.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {r.course.location}
                            </span>
                          )}
                        </div>
                      </div>
                      {r.session_date === today ? (
                        <Badge className="border-transparent bg-primary text-primary-foreground">
                          Heute{timeLabel(r) ? `, ${timeLabel(r)}` : ""}
                        </Badge>
                      ) : timeLabel(r) ? (
                        <span className="text-xs text-muted-foreground">{timeLabel(r)}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CollapsibleCard>
            ))}
          </div>
        )}
      </CollapsibleCard>
    </div>
  );
}

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
function weekdayLabel(date: string) {
  return WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()] ?? "";
}
function timeLabel(r: { start_time: string | null; end_time: string | null }) {
  if (!r.start_time) return "";
  const a = r.start_time.slice(0, 5);
  return r.end_time ? `${a}–${r.end_time.slice(0, 5)} Uhr` : `${a} Uhr`;
}

/** Hinweis, solange für die Auszahlung der Übungsleiterpauschale noch keine IBAN hinterlegt ist. */
function PayoutIbanNotice() {
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      if (!(roles ?? []).some((r) => r.role === "trainer")) return;
      const res = await getMyPayoutDetails();
      setMissing(!res.details);
    })().catch(() => setMissing(false));
  }, []);
  if (!missing) return null;
  return (
    <Card className="border-0 shadow-soft bg-accent/10">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm">
          <div className="font-semibold text-primary-deep">Deine IBAN fehlt noch</div>
          <div className="text-muted-foreground">
            Damit wir die Übungsleiterpauschale überweisen können, trag bitte deine Bankverbindung
            ein.
          </div>
        </div>
        <Link
          to="/portal/profil"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          IBAN eintragen
        </Link>
      </CardContent>
    </Card>
  );
}

function StatCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) {
  const body = (
    <CardContent className="p-4">
      <div className="text-2xl font-bold text-primary-deep">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </CardContent>
  );
  if (!onClick) return <Card className="border-0 shadow-soft">{body}</Card>;
  return (
    <Card className="border-0 shadow-soft transition-shadow hover:shadow-md">
      <button type="button" onClick={onClick} className="w-full text-left">
        {body}
      </button>
    </Card>
  );
}
