import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, Check, ClipboardCheck, MapPin, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { addDays } from "@/lib/dienstplan";
import { withdrawFromSessions } from "@/lib/dienstplan.functions";
import { confirmAssignments, teamForSessions } from "@/lib/trainer-extras.functions";
import { formatDateBerlin } from "@/lib/format";

export type WeekRow = {
  id: string;
  session_date: string;
  session_index: number;
  start_time: string | null;
  end_time: string | null;
  course: {
    name: string;
    location: string | null;
    schedule: string | null;
    trainer_id?: string | null;
  } | null;
};

const REASONS = ["Krank", "Privat verhindert", "Beruflich verhindert"];
const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const weekday = (d: string) => WEEKDAYS[new Date(`${d}T12:00:00Z`).getUTCDay()] ?? "";
const time = (r: WeekRow) =>
  r.start_time
    ? `${r.start_time.slice(0, 5)}${r.end_time ? `–${r.end_time.slice(0, 5)}` : ""} Uhr`
    : "";

/**
 * „Diese Woche“: die nächsten Einsätze mit allem, was man vor Ort braucht – Ort mit Route, Team,
 * Anwesenheit – und den zwei häufigsten Aktionen (bestätigen, absagen) direkt am Termin.
 */
export function WeekShifts({
  rows,
  me,
  today,
  loading,
}: {
  rows: WeekRow[];
  me: string;
  today: string;
  loading: boolean;
}) {
  const teamFn = useServerFn(teamForSessions);
  const confirmFn = useServerFn(confirmAssignments);
  const withdrawFn = useServerFn(withdrawFromSessions);
  const [team, setTeam] = useState<Record<string, { id: string; name: string }[]>>({});
  const [unconfirmed, setUnconfirmed] = useState<Set<string>>(new Set());
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());

  // Die nächsten 7 Tage; gibt es dort nichts, die nächsten 3 Einsätze
  const weekEnd = addDays(today, 6);
  const shown = useMemo(() => {
    const inWeek = rows.filter((r) => r.session_date <= weekEnd && !gone.has(r.id));
    return inWeek.length ? inWeek : rows.filter((r) => !gone.has(r.id)).slice(0, 3);
  }, [rows, weekEnd, gone]);
  const isWeek = shown.length > 0 && shown[0]!.session_date <= weekEnd;

  const key = shown.map((s) => s.id).join(",");
  async function loadExtras() {
    if (!shown.length) return;
    try {
      setTeam((await teamFn({ data: { sessionIds: shown.map((s) => s.id) } })).team);
    } catch {
      /* Team ist optional */
    }
    const { data, error } = await (supabase as any)
      .from("course_session_assignments")
      .select("session_id,confirmed_at")
      .eq("trainer_id", me)
      .in(
        "session_id",
        shown.map((s) => s.id),
      );
    if (!error)
      setUnconfirmed(
        new Set((data ?? []).filter((r: any) => !r.confirmed_at).map((r: any) => r.session_id)),
      );
  }
  useEffect(() => {
    void loadExtras();
  }, [key, me]);

  async function confirm(id: string) {
    setBusy(id);
    try {
      await confirmFn({ data: { sessionIds: [id] } });
      setUnconfirmed((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      toast.success("Bestätigt. Danke!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bestätigen nicht möglich");
    } finally {
      setBusy(null);
    }
  }

  async function cancel(id: string) {
    if (reason.trim().length < 2) return;
    setBusy(id);
    try {
      await withdrawFn({ data: { sessionIds: [id], reason: reason.trim() } });
      toast.success("Abgesagt. Der Vorstand wurde informiert und sucht Ersatz.");
      setGone((prev) => new Set(prev).add(id));
      setCancelling(null);
      setReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Absage nicht möglich");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <Card className="border-0 shadow-soft">
        <CardContent className="py-8 text-center text-muted-foreground">Wird geladen …</CardContent>
      </Card>
    );
  }
  if (shown.length === 0) {
    return (
      <Card className="border-0 shadow-soft">
        <CardContent className="space-y-3 p-5">
          <div className="font-semibold text-primary-deep">Keine Einsätze in Sicht</div>
          <p className="text-sm text-muted-foreground">
            Du bist aktuell für keine kommenden Termine eingeteilt. Sag dem Vorstand, wofür du zur
            Verfügung stehst.
          </p>
          <Button asChild size="sm" className="min-h-11">
            <Link to="/trainer/verfuegbarkeit">Verfügbarkeit eintragen</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section aria-labelledby="week-heading" className="space-y-3">
      <h2 id="week-heading" className="font-display text-xl font-bold text-primary-deep">
        {isWeek ? "Diese Woche" : "Nächste Einsätze"}
      </h2>
      {shown.map((r) => {
        const others = (team[r.id] ?? []).filter((p) => p.id !== me).map((p) => p.name);
        const fixed = r.course?.trainer_id === me;
        const loc = r.course?.location;
        return (
          <Card key={r.id} className="border-0 shadow-soft">
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-base font-bold text-primary-deep">
                    {r.course?.name ?? "Kurs"}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      ({r.session_index}. Termin)
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-4 w-4" />
                      {weekday(r.session_date)}, {formatDateBerlin(r.session_date)}
                      {time(r) ? ` · ${time(r)}` : ""}
                    </span>
                    {loc && (
                      <a
                        className="inline-flex items-center gap-1 underline hover:text-primary"
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MapPin className="h-4 w-4" />
                        {loc} (Route)
                      </a>
                    )}
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {others.length > 0
                      ? `Mit ${others.join(", ")}`
                      : "Noch niemand sonst eingeteilt"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {r.session_date === today && (
                    <Badge className="border-transparent bg-primary text-primary-foreground">
                      Heute
                    </Badge>
                  )}
                  {unconfirmed.has(r.id) && <Badge variant="outline">Bitte bestätigen</Badge>}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" className="min-h-11 flex-1 sm:flex-none">
                  <Link to="/trainer/kurse">
                    <ClipboardCheck className="h-4 w-4" /> Anwesenheit
                  </Link>
                </Button>
                {unconfirmed.has(r.id) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 flex-1 sm:flex-none"
                    disabled={busy === r.id}
                    onClick={() => void confirm(r.id)}
                  >
                    <Check className="h-4 w-4" /> Bestätigen
                  </Button>
                )}
                {!fixed && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-11 flex-1 sm:flex-none"
                    aria-expanded={cancelling === r.id}
                    onClick={() => {
                      setCancelling(cancelling === r.id ? null : r.id);
                      setReason("");
                    }}
                  >
                    <X className="h-4 w-4" /> Kann nicht
                  </Button>
                )}
              </div>

              {fixed && (
                <p className="text-xs text-muted-foreground">
                  Du bist diesem Kurs fest zugeordnet – bitte telefonisch absagen.
                </p>
              )}

              {cancelling === r.id && (
                <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <div className="text-sm font-medium text-destructive">
                    Für diesen Termin absagen – der Vorstand sucht Ersatz
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {REASONS.map((x) => (
                      <Button
                        key={x}
                        size="sm"
                        type="button"
                        className="min-h-9"
                        variant={reason === x ? "default" : "outline"}
                        onClick={() => setReason(x)}
                      >
                        {x}
                      </Button>
                    ))}
                  </div>
                  <Input
                    placeholder="Grund (Pflicht, kurz)"
                    aria-label="Grund der Absage"
                    value={reason}
                    maxLength={300}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <Button
                    variant="destructive"
                    className="min-h-11"
                    disabled={busy === r.id || reason.trim().length < 2}
                    onClick={() => void cancel(r.id)}
                  >
                    Absagen
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      <Link
        to="/trainer/verfuegbarkeit"
        className="inline-block text-sm font-medium text-primary underline"
      >
        Alle meine Einsätze ansehen
      </Link>
    </section>
  );
}
