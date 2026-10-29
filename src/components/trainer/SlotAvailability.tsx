import { CalendarCheck, Check, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { supabase } from "@/integrations/supabase/client";
import { blackoutOn, type PlanBlackout } from "@/lib/dienstplan";
import { todayBerlinIso } from "@/lib/format";
import { POOLS, holidayName } from "@/lib/pool-schedule";

type Slot = {
  pool: string;
  date: string;
  start: string | null;
  end: string | null;
  mode: string | null;
};

const MONTHS = 6;
const dayText = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
const monthText = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("de-DE", { month: "long", year: "numeric" });

/**
 * Einsatzmöglichkeit für die nächsten Monate: Der Vorstand plant Kurse anhand der Zusagen,
 * noch bevor es Kurstermine gibt. Sperrzeiten gelten automatisch als „kann nicht“.
 */
export function SlotAvailability({ me, blackouts }: { me: string; blackouts: PlanBlackout[] }) {
  const db = supabase as any;
  const [slots, setSlots] = useState<Slot[]>([]);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const key = (s: { pool: string; date: string }) => `${s.pool}|${s.date}`;

  async function load() {
    const today = todayBerlinIso();
    const end = new Date();
    end.setMonth(end.getMonth() + MONTHS);
    const [s, a] = await Promise.all([
      db
        .from("pool_slots")
        .select("pool,slot_date,start_time,end_time,closed,mode")
        .gte("slot_date", today)
        .lte("slot_date", end.toISOString().slice(0, 10))
        .eq("closed", false)
        .order("slot_date"),
      db
        .from("pool_slot_availability")
        .select("pool,slot_date,available")
        .eq("trainer_id", me)
        .gte("slot_date", today),
    ]);
    if (s.error || a.error) return; // Migration noch nicht eingespielt: Karte bleibt leer.
    setSlots(
      (s.data ?? [])
        // Familienschwimmen, entfallene Termine und Feiertage brauchen keine Zusage.
        .filter(
          (r: any) =>
            r.mode !== "familie" &&
            r.mode !== "entfaellt" &&
            (r.mode === "open" || !holidayName(r.slot_date)),
        )
        .map((r: any) => ({
          pool: r.pool,
          date: r.slot_date,
          start: r.start_time?.slice(0, 5) ?? null,
          end: r.end_time?.slice(0, 5) ?? null,
          mode: r.mode,
        })),
    );
    setAnswers(
      Object.fromEntries((a.data ?? []).map((r: any) => [`${r.pool}|${r.slot_date}`, r.available])),
    );
  }

  useEffect(() => {
    if (me) void load();
  }, [me]);

  async function answer(list: Slot[], available: boolean | null) {
    setBusy(true);
    const keys = list.map(key);
    setAnswers((cur) => {
      const next = { ...cur };
      for (const k of keys) {
        if (available === null) delete next[k];
        else next[k] = available;
      }
      return next;
    });
    const res =
      available === null
        ? await Promise.all(
            list.map((s) =>
              db
                .from("pool_slot_availability")
                .delete()
                .eq("trainer_id", me)
                .eq("pool", s.pool)
                .eq("slot_date", s.date),
            ),
          ).then((r) => r.find((x) => x.error) ?? { error: null })
        : await db.from("pool_slot_availability").upsert(
            list.map((s) => ({ pool: s.pool, slot_date: s.date, trainer_id: me, available })),
            { onConflict: "pool,slot_date,trainer_id" },
          );
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      await load();
    }
  }

  const months = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots) {
      const k = `${s.pool}|${s.date.slice(0, 7)}`;
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()];
  }, [slots]);

  if (!slots.length) return null;
  const open = slots.filter(
    (s) => answers[key(s)] === undefined && !blackoutOn(blackouts, me, s.date),
  ).length;

  return (
    <CollapsibleCard
      title={
        <span className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4" /> Einsatzmöglichkeit für die nächsten Monate
        </span>
      }
      subtitle="Für welche Badtermine kannst du als Trainer:in einspringen? Damit planen wir neue Kurse."
      meta={open > 0 ? <Badge variant="destructive">{open} offen</Badge> : <Badge>erledigt</Badge>}
      defaultOpen={open > 0}
      storageKey="slot-availability"
      className="mb-6"
    >
      <div className="space-y-5">
        {months.map(([k, list]) => {
          const pool = POOLS.find((p) => p.id === list[0].pool);
          return (
            <div key={k}>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">
                  {monthText(list[0].date)} · {pool?.name}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      answer(
                        list.filter((s) => !blackoutOn(blackouts, me, s.date)),
                        true,
                      )
                    }
                  >
                    Alle zusagen
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => answer(list, false)}
                  >
                    Alle absagen
                  </Button>
                </div>
              </div>
              <div className="divide-y rounded-md border">
                {list.map((s) => {
                  const block = blackoutOn(blackouts, me, s.date);
                  const a = answers[key(s)];
                  return (
                    <div
                      key={key(s)}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">{dayText(s.date)}</span>{" "}
                        <span className="text-muted-foreground">
                          {s.start ? `${s.start}–${s.end} Uhr` : ""}
                        </span>
                      </div>
                      {block ? (
                        <span className="text-xs text-muted-foreground">
                          Sperrzeit{block.note ? `: ${block.note}` : ""} – gilt als „kann nicht“
                        </span>
                      ) : (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant={a === true ? "default" : "outline"}
                            disabled={busy}
                            onClick={() => answer([s], a === true ? null : true)}
                          >
                            <Check className="h-4 w-4" /> Kann
                          </Button>
                          <Button
                            size="sm"
                            variant={a === false ? "destructive" : "outline"}
                            disabled={busy}
                            onClick={() => answer([s], a === false ? null : false)}
                          >
                            <X className="h-4 w-4" /> Kann nicht
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </CollapsibleCard>
  );
}
