import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { applyAssignments } from "@/lib/dienstplan.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CalendarEntry } from "@/lib/calendar.functions";

type Trainer = { id: string; name: string };

function shortDay(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * Dienstplan eines Kurses: Termine als Spalten, Trainer:innen als Zeilen.
 * Ziel: ein möglichst gleichbleibendes Team über alle Termine.
 */
export function CourseRosterMatrix({
  sessions,
  trainers,
  onChanged,
}: {
  sessions: CalendarEntry[];
  trainers: Trainer[];
  onChanged: (sessionId: string, trainerId: string, on: boolean) => void;
}) {
  const apply = useServerFn(applyAssignments);
  const [busy, setBusy] = useState(false);
  const [notify, setNotify] = useState(true);
  const sorted = [...sessions].sort((a, b) =>
    (a.date + (a.startTime ?? "")).localeCompare(b.date + (b.startTime ?? "")),
  );
  const has = (s: CalendarEntry, t: string) => (s.assignedIds ?? []).includes(t);
  const avail = (s: CalendarEntry, t: string) => s.availability?.find((a) => a.id === t)?.available;
  const team = trainers
    .map((t) => ({ ...t, count: sorted.filter((s) => has(s, t.id)).length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const [showAll, setShowAll] = useState(false);
  const visible = showAll
    ? team
    : team.filter((t) => t.count > 0 || sorted.some((s) => avail(s, t.id) === true));

  // Einteilen läuft über den Server: Protokoll im Dienstplan und (optional) Mail an die Trainer:in
  async function change(targets: CalendarEntry[], t: Trainer, on: boolean) {
    setBusy(true);
    try {
      const res = await apply({
        data: {
          changes: targets.map((s) => ({ sessionId: s.id, trainerId: t.id, on })),
          notify,
        },
      });
      targets.forEach((s) => onChanged(s.id, t.id, on));
      return res;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Änderung fehlgeschlagen");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function toggle(s: CalendarEntry, t: Trainer, on: boolean) {
    await change([s], t, on);
  }

  async function setAll(t: Trainer, on: boolean) {
    const targets = sorted.filter(
      (s) => has(s, t.id) !== on && (on ? avail(s, t.id) !== false : true),
    );
    if (!targets.length) return;
    const res = await change(targets, t, on);
    if (!res) return;
    toast.success(
      on
        ? `${t.name} für ${targets.length} Termin(e) eingeteilt`
        : `${t.name} aus ${targets.length} Termin(en) ausgeteilt`,
    );
  }

  if (!sorted.length) return <div className="text-sm text-muted-foreground">Keine Termine.</div>;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background p-1 text-left">Trainer:in</th>
              {sorted.map((s) => {
                const n = (s.assignedIds ?? []).length;
                const required = s.trainersNeeded ?? 2;
                return (
                  <th key={s.id} className="p-1 text-center font-normal whitespace-nowrap">
                    <div>{shortDay(s.date)}</div>
                    <Badge
                      variant={n >= required ? "secondary" : "outline"}
                      className={n >= required ? "" : "border-destructive text-destructive"}
                    >
                      {n}/{required}
                    </Badge>
                  </th>
                );
              })}
              <th className="p-1">Alle Termine</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="sticky left-0 bg-background p-1 whitespace-nowrap font-medium">
                  {t.name}{" "}
                  <span className="text-muted-foreground">
                    ({t.count}/{sorted.length})
                  </span>
                </td>
                {sorted.map((s) => {
                  const on = has(s, t.id);
                  const a = avail(s, t.id);
                  return (
                    <td key={s.id} className="p-1 text-center">
                      <button
                        type="button"
                        title={
                          a === false
                            ? "hat abgesagt"
                            : a === true
                              ? "verfügbar"
                              : "keine Rückmeldung"
                        }
                        onClick={() => void toggle(s, t, !on)}
                        className={`h-7 w-7 rounded border text-sm ${on ? "bg-primary text-primary-foreground" : a === false ? "bg-destructive/10 text-destructive" : a === true ? "bg-accent" : ""}`}
                      >
                        {on ? "✓" : a === false ? "✕" : a === true ? "·" : ""}
                      </button>
                    </td>
                  );
                })}
                <td className="p-1 whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void setAll(t, true)}
                  >
                    Alle
                  </Button>{" "}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy || t.count === 0}
                    onClick={() => void setAll(t, false)}
                  >
                    Keine
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>✓ eingeteilt · „·“ verfügbar · ✕ abgesagt (wird bei „Alle“ übersprungen)</span>
        <label className="flex items-center gap-1.5">
          <Checkbox checked={notify} onCheckedChange={(v) => setNotify(!!v)} />
          Trainer:in per Mail informieren
        </label>
        <Button size="sm" variant="link" onClick={() => setShowAll((v) => !v)}>
          {showAll
            ? "Nur Team & Verfügbare zeigen"
            : `Alle ${trainers.length} Trainer:innen zeigen`}
        </Button>
      </div>
    </div>
  );
}
