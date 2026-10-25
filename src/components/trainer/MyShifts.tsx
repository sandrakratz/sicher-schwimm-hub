import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, CalendarCheck, HandHelping } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { claimSession, withdrawFromSessions } from "@/lib/dienstplan.functions";
import { shortDate, timeText } from "@/lib/dienstplan";
import { parseTimeRange } from "@/lib/ics";
import { todayBerlinIso } from "@/lib/format";

export type ShiftSession = {
  id: string;
  course_id: string;
  session_index: number;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  assigned_trainer_id: string | null;
  replacement_requested_at: string | null;
};
export type ShiftCourse = {
  id: string;
  name: string;
  location: string | null;
  schedule: string | null;
  duration: string | null;
  trainers_needed: number | null;
  trainer_id: string | null;
};

const REASONS = ["Krank", "Privat verhindert", "Beruflich verhindert"];

/**
 * „Ersatz gesucht“ (vom Vorstand angefragt) und „Meine Einsätze“ mit Absage per Klick.
 * Eine Absage nimmt mich sofort aus dem Dienstplan; der Vorstand bekommt eine Mail und sucht Ersatz.
 */
export function MyShifts({
  me,
  sessions,
  courses,
  team,
  onChanged,
}: {
  me: string;
  sessions: ShiftSession[];
  courses: Record<string, ShiftCourse>;
  /** Eingeteilte je Termin (Dienstplan). */
  team: Map<string, Set<string>>;
  onChanged: () => void;
}) {
  const withdraw = useServerFn(withdrawFromSessions);
  const claim = useServerFn(claimSession);
  const today = todayBerlinIso();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const label = (s: ShiftSession) => {
    const c = courses[s.course_id];
    const t = s.start_time
      ? { start: s.start_time.slice(0, 5), end: s.end_time?.slice(0, 5) ?? null }
      : parseTimeRange(c?.schedule, c?.duration);
    return {
      when: `${shortDate(s.session_date)} · ${timeText({ start: t?.start ?? null, end: t?.end ?? null })}`,
      what: `${c?.name ?? "Kurs"} (${s.session_index}. Termin)${c?.location ? ` · ${c.location}` : ""}`,
    };
  };

  const members = (s: ShiftSession) => {
    const set = new Set(team.get(s.id) ?? []);
    if (s.assigned_trainer_id) set.add(s.assigned_trainer_id);
    const fixed = courses[s.course_id]?.trainer_id;
    if (fixed) set.add(fixed);
    return set;
  };

  const sorted = [...sessions]
    .filter((s) => s.session_date >= today)
    .sort((a, b) => a.session_date.localeCompare(b.session_date));
  const mine = sorted.filter((s) => members(s).has(me));
  const withdrawable = mine.filter((s) => courses[s.course_id]?.trainer_id !== me);
  const requests = sorted.filter(
    (s) =>
      s.replacement_requested_at &&
      !members(s).has(me) &&
      members(s).size < (courses[s.course_id]?.trainers_needed ?? 2),
  );

  async function takeOver(s: ShiftSession) {
    setBusy(s.id);
    try {
      await claim({ data: { sessionId: s.id } });
      toast.success("Danke! Du bist für diesen Termin eingeteilt.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Übernehmen nicht möglich");
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function cancelSelected() {
    if (picked.size === 0 || reason.trim().length < 2) return;
    setBusy("withdraw");
    try {
      const res = await withdraw({ data: { sessionIds: [...picked], reason: reason.trim() } });
      toast.success(
        `Abgesagt für ${res.removed} Termin(e). Der Vorstand wurde informiert und sucht Ersatz.`,
      );
      setPicked(new Set());
      setReason("");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Absage nicht möglich");
    } finally {
      setBusy(null);
    }
  }

  if (requests.length === 0 && mine.length === 0) return null;

  return (
    <div className="mb-8 space-y-4">
      {requests.length > 0 && (
        <Card className="border-2 border-amber-400/60 bg-amber-50/50 shadow-soft dark:bg-amber-950/10">
          <CardContent className="py-4">
            <div className="mb-3 flex items-center gap-2 font-semibold">
              <HandHelping className="h-5 w-5" /> Ersatz gesucht – kannst du einspringen?
            </div>
            <div className="divide-y rounded-md border bg-background">
              {requests.map((s) => {
                const l = label(s);
                return (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{l.when}</div>
                      <div className="text-xs text-muted-foreground">{l.what}</div>
                    </div>
                    <Button
                      className="min-h-11"
                      disabled={busy === s.id}
                      onClick={() => void takeOver(s)}
                    >
                      Ich übernehme
                    </Button>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Wer zuerst klickt, ist eingeteilt. Der Vorstand wird automatisch informiert.
            </p>
          </CardContent>
        </Card>
      )}

      {mine.length > 0 && (
        <Card className="border-0 shadow-soft">
          <CardContent className="py-4">
            <div className="mb-1 flex items-center gap-2 font-semibold text-primary-deep">
              <CalendarCheck className="h-5 w-5" /> Meine Einsätze ({mine.length})
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Du kannst nicht mehr? Termine ankreuzen, Grund angeben, absagen – jederzeit, auch
              kurzfristig. Der Vorstand bekommt sofort Bescheid.
            </p>
            <div className="max-h-80 divide-y overflow-y-auto rounded-md border">
              {mine.map((s) => {
                const l = label(s);
                const fixed = courses[s.course_id]?.trainer_id === me;
                return (
                  <label
                    key={s.id}
                    className={`flex items-center gap-3 p-3 ${fixed ? "" : "cursor-pointer"}`}
                  >
                    <Checkbox
                      disabled={fixed}
                      checked={picked.has(s.id)}
                      onCheckedChange={(v) =>
                        setPicked((prev) => {
                          const n = new Set(prev);
                          if (v) n.add(s.id);
                          else n.delete(s.id);
                          return n;
                        })
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{l.when}</span>
                      <span className="block text-xs text-muted-foreground">
                        {l.what}
                        {fixed ? " · fest zugeordnet – bitte telefonisch absagen" : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            {withdrawable.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => setPicked(new Set(withdrawable.map((s) => s.id)))}
                  >
                    Alle auswählen
                  </Button>
                  <span className="text-muted-foreground">{picked.size} ausgewählt</span>
                </div>
                {picked.size > 0 && (
                  <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <AlertTriangle className="h-4 w-4" /> Für {picked.size} Termin(e) absagen
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {REASONS.map((r) => (
                        <Button
                          key={r}
                          size="sm"
                          variant={reason === r ? "default" : "outline"}
                          className="h-7"
                          onClick={() => setReason(r)}
                        >
                          {r}
                        </Button>
                      ))}
                    </div>
                    <Input
                      placeholder="Grund (Pflicht, kurz)"
                      value={reason}
                      maxLength={300}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <Button
                      variant="destructive"
                      className="min-h-11"
                      disabled={busy === "withdraw" || reason.trim().length < 2}
                      onClick={() => void cancelSelected()}
                    >
                      Kann doch nicht – absagen
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
