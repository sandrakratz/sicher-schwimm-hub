import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CalendarEntry } from "@/lib/calendar.functions";

type Trainer = { id: string; name: string };

function shortDay(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}

/**
 * Dienstplan eines Kurses: Termine als Spalten, Trainer:innen als Zeilen.
 * Ziel: ein möglichst gleichbleibendes Team über alle Termine.
 */
export function CourseRosterMatrix({ sessions, trainers, onChanged }: {
  sessions: CalendarEntry[];
  trainers: Trainer[];
  onChanged: (sessionId: string, trainerId: string, on: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const sorted = [...sessions].sort((a, b) => (a.date + (a.startTime ?? "")).localeCompare(b.date + (b.startTime ?? "")));
  const has = (s: CalendarEntry, t: string) => (s.assignedIds ?? []).includes(t);
  const avail = (s: CalendarEntry, t: string) => s.availability?.find((a) => a.id === t)?.available;
  const team = trainers
    .map((t) => ({ ...t, count: sorted.filter((s) => has(s, t.id)).length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? team : team.filter((t) => t.count > 0 || sorted.some((s) => avail(s, t.id) === true));

  async function toggle(s: CalendarEntry, t: Trainer, on: boolean) {
    const res = on
      ? await supabase.from("course_session_assignments").insert({ session_id: s.id, trainer_id: t.id })
      : await supabase.from("course_session_assignments").delete().eq("session_id", s.id).eq("trainer_id", t.id);
    if (res.error) return toast.error(res.error.message);
    onChanged(s.id, t.id, on);
  }

  async function setAll(t: Trainer, on: boolean) {
    const targets = sorted.filter((s) => has(s, t.id) !== on && (on ? avail(s, t.id) !== false : true));
    if (!targets.length) return;
    setBusy(true);
    const res = on
      ? await supabase.from("course_session_assignments").insert(targets.map((s) => ({ session_id: s.id, trainer_id: t.id })))
      : await supabase.from("course_session_assignments").delete().eq("trainer_id", t.id).in("session_id", targets.map((s) => s.id));
    setBusy(false);
    if (res.error) return toast.error(res.error.message);
    targets.forEach((s) => onChanged(s.id, t.id, on));
    toast.success(on ? `${t.name} für ${targets.length} Termin(e) eingeteilt` : `${t.name} aus ${targets.length} Termin(en) ausgeteilt`);
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
                return (
                  <th key={s.id} className="p-1 text-center font-normal whitespace-nowrap">
                    <div>{shortDay(s.date)}</div>
                    <Badge variant={n >= 2 ? "secondary" : "outline"} className={n >= 2 ? "" : "border-destructive text-destructive"}>{n}</Badge>
                  </th>
                );
              })}
              <th className="p-1">Alle Termine</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="sticky left-0 bg-background p-1 whitespace-nowrap font-medium">{t.name} <span className="text-muted-foreground">({t.count}/{sorted.length})</span></td>
                {sorted.map((s) => {
                  const on = has(s, t.id);
                  const a = avail(s, t.id);
                  return (
                    <td key={s.id} className="p-1 text-center">
                      <button
                        type="button"
                        title={a === false ? "hat abgesagt" : a === true ? "verfügbar" : "keine Rückmeldung"}
                        onClick={() => void toggle(s, t, !on)}
                        className={`h-7 w-7 rounded border text-sm ${on ? "bg-primary text-primary-foreground" : a === false ? "bg-destructive/10 text-destructive" : a === true ? "bg-accent" : ""}`}
                      >
                        {on ? "✓" : a === false ? "✕" : a === true ? "·" : ""}
                      </button>
                    </td>
                  );
                })}
                <td className="p-1 whitespace-nowrap">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void setAll(t, true)}>Alle</Button>{" "}
                  <Button size="sm" variant="ghost" disabled={busy || t.count === 0} onClick={() => void setAll(t, false)}>Keine</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>✓ eingeteilt · „·“ verfügbar · ✕ abgesagt (wird bei „Alle“ übersprungen)</span>
        <Button size="sm" variant="link" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Nur Team & Verfügbare zeigen" : `Alle ${trainers.length} Trainer:innen zeigen`}
        </Button>
      </div>
    </div>
  );
}
