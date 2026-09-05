import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listCourseTrainerAttendance,
  setOwnTrainerAttendance,
  confirmTrainerAttendance,
  type TrainerAttendanceRow,
  type TrainerSessionRow,
} from "@/lib/trainer-attendance.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateBerlin, formatDateTimeBerlin } from "@/lib/format";
import { toast } from "sonner";

function sessionLabel(s: TrainerSessionRow): string {
  const time = s.start_time ? ` · ${s.start_time.slice(0, 5)} Uhr` : "";
  return `${s.session_index}. Termin – ${formatDateBerlin(s.session_date)}${time}`;
}

/**
 * Trainer-Anwesenheit je Kurstermin: Trainer:innen tragen sich selbst ein,
 * Vorstand/Verwaltung bestätigt die Einträge (Steuernachweis).
 */
export function TrainerAttendancePanel({ courseId }: { courseId: string }) {
  const load = useServerFn(listCourseTrainerAttendance);
  const saveOwn = useServerFn(setOwnTrainerAttendance);
  const confirmFn = useServerFn(confirmTrainerAttendance);

  const [sessions, setSessions] = useState<TrainerSessionRow[]>([]);
  const [rows, setRows] = useState<TrainerAttendanceRow[]>([]);
  const [isStaff, setIsStaff] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    const res = await load({ data: { courseId } });
    setSessions(res.sessions);
    setRows(res.rows);
    setIsStaff(res.isStaff);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!cancelled) setMe(u.user?.id ?? null);
        await refresh();
      } catch (e: unknown) {
        if (!cancelled) toast.error((e as Error)?.message || "Trainer-Anwesenheit konnte nicht geladen werden");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  async function toggleOwn(sessionId: string, present: boolean | null) {
    setBusy(sessionId);
    try {
      await saveOwn({ data: { sessionId, present } });
      await refresh();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Speichern fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  }

  async function confirmSession(sessionId: string, confirm: boolean) {
    setBusy(sessionId);
    try {
      await confirmFn({ data: { sessionId, confirm } });
      await refresh();
      toast.success(confirm ? "Bestätigt" : "Bestätigung aufgehoben");
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Bestätigen fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Trainer-Anwesenheit wird geladen…</p>;
  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">Für diesen Kurs sind noch keine Termine angelegt.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Nachweis für die Abrechnung: Trainer:innen bestätigen ihre eigene Anwesenheit, der Vorstand zeichnet gegen.
      </p>
      {sessions.map(s => {
        const entries = rows.filter(r => r.session_id === s.id);
        const mine = entries.find(r => r.trainer_id === me);
        const openCount = entries.filter(r => !r.confirmed_at).length;
        return (
          <div key={s.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">{sessionLabel(s)}</span>
              {isStaff && entries.length > 0 && (
                openCount > 0 ? (
                  <Button size="sm" disabled={busy === s.id} onClick={() => confirmSession(s.id, true)}>
                    {openCount} Eintrag/Einträge bestätigen
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => confirmSession(s.id, false)}>
                    Bestätigung aufheben
                  </Button>
                )
              )}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 sm:max-w-sm">
              <Button
                type="button"
                variant={mine?.present === true ? "default" : "outline"}
                className="min-h-11 text-xs"
                disabled={busy === s.id || !!mine?.confirmed_at}
                onClick={() => toggleOwn(s.id, mine?.present === true ? null : true)}
              >
                Ich war anwesend
              </Button>
              <Button
                type="button"
                variant={mine?.present === false ? "default" : "outline"}
                className="min-h-11 text-xs"
                disabled={busy === s.id || !!mine?.confirmed_at}
                onClick={() => toggleOwn(s.id, mine?.present === false ? null : false)}
              >
                Nicht anwesend
              </Button>
            </div>
            {mine?.confirmed_at && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Vom Vorstand bestätigt – Änderung nicht mehr möglich.
              </p>
            )}

            <div className="mt-2 space-y-1">
              {entries.length === 0 && <span className="text-xs text-muted-foreground">Noch keine Eintragungen.</span>}
              {entries.map(r => (
                <div key={r.trainer_id} className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge
                    className={
                      r.present
                        ? "border-transparent bg-green-600 text-white"
                        : "border-transparent bg-red-100 text-red-900"
                    }
                  >
                    {r.trainer_name}: {r.present ? "anwesend" : "nicht anwesend"}
                  </Badge>
                  <span className="text-muted-foreground">
                    erfasst {formatDateTimeBerlin(r.recorded_at)}
                  </span>
                  {r.confirmed_at ? (
                    <span className="text-green-700">
                      bestätigt {formatDateTimeBerlin(r.confirmed_at)}
                      {r.confirmed_by_name ? ` · ${r.confirmed_by_name}` : ""}
                    </span>
                  ) : (
                    <span className="text-amber-700">noch nicht bestätigt</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default TrainerAttendancePanel;
