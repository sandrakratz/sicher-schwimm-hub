import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  listOpenTrainerAttendance,
  confirmTrainerAttendance,
  correctTrainerAttendance,
  type OpenAttendanceRow,
} from "@/lib/trainer-attendance.functions";
import { formatDateBerlin } from "@/lib/format";

/** Alle noch nicht bestätigten Trainer-Anwesenheiten auf einen Blick – direkt bestätigen. */
export function AttendanceConfirm({ onChanged }: { onChanged?: () => void }) {
  const load = useServerFn(listOpenTrainerAttendance);
  const confirmFn = useServerFn(confirmTrainerAttendance);
  const correctFn = useServerFn(correctTrainerAttendance);
  const [rows, setRows] = useState<OpenAttendanceRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setRows(await load());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Konnte nicht geladen werden");
      setRows([]);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function confirm(items: OpenAttendanceRow[], key: string) {
    setBusy(key);
    try {
      for (const r of items) {
        await confirmFn({
          data: { sessionId: r.session_id, trainerId: r.trainer_id, confirm: true },
        });
      }
      toast.success(items.length === 1 ? "Bestätigt" : `${items.length} Einträge bestätigt`);
      await refresh();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bestätigen fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  }

  /** Eintrag ablehnen (→ „nicht anwesend“) bzw. umgekehrt; gilt sofort als bestätigt. */
  async function correct(r: OpenAttendanceRow) {
    const toPresent = !r.present;
    const reason = window.prompt(
      toPresent
        ? `${r.trainer_name} doch als „anwesend“ eintragen und bestätigen?\nGrund (optional):`
        : `${r.trainer_name} als „nicht anwesend“ eintragen (Eintrag ablehnen)?\nGrund (optional), z. B. „nach der 1. Stunde gegangen“:`,
      "",
    );
    if (reason === null) return;
    setBusy(`${r.session_id}:${r.trainer_id}`);
    try {
      await correctFn({
        data: {
          sessionId: r.session_id,
          trainerId: r.trainer_id,
          present: toPresent,
          note: reason,
        },
      });
      toast.success(toPresent ? "Auf „anwesend“ korrigiert" : "Eintrag abgelehnt: nicht anwesend");
      await refresh();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Korrigieren fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  }

  if (!rows) return <p className="text-sm text-muted-foreground">Wird geladen…</p>;
  if (rows.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Alles bestätigt – keine offenen Trainer-Einträge.
      </p>
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Hier stehen alle Anwesenheiten, die Trainer:innen selbst eingetragen haben und die du noch
          nicht bestätigt hast (Steuernachweis).
        </p>
        <Button size="sm" disabled={busy !== null} onClick={() => confirm(rows, "all")}>
          Alle {rows.length} bestätigen
        </Button>
      </div>
      <div className="divide-y rounded-lg border">
        {rows.map((r) => {
          const key = `${r.session_id}:${r.trainer_id}`;
          return (
            <div key={key} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{r.trainer_name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.course_name} · {r.session_index}. Termin – {formatDateBerlin(r.session_date)}
                  {r.start_time ? ` · ${r.start_time.slice(0, 5)} Uhr` : ""}
                </div>
              </div>
              <Badge
                className={
                  r.present
                    ? "border-transparent bg-green-600 text-white"
                    : "border-transparent bg-red-100 text-red-900"
                }
              >
                {r.present ? "anwesend" : "nicht anwesend"}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={busy !== null}
                onClick={() => void correct(r)}
              >
                {r.present ? "Ablehnen" : "Doch anwesend"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => confirm([r], key)}
              >
                Bestätigen
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
