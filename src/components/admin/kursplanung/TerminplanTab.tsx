import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { holidayName, hourStart } from "@/lib/pool-schedule";
import type { Planning } from "./usePlanning";
import {
  MODE_LABEL,
  fmt,
  hhmm,
  monthLabel,
  overlaps,
  skipReason,
  time,
  type Entry,
  type Mode,
  type StoredSlot,
} from "./utils";

const db = supabase as any;

const LEGEND = [
  ["border border-slate-300 bg-slate-100", "läuft bereits"],
  ["border border-dashed border-emerald-500 bg-emerald-50", "Vorschlag"],
  ["bg-muted-foreground/30", "gesperrt"],
];

function Chip({ e }: { e: Entry }) {
  return (
    <div
      title={`${e.label} ${e.start}–${e.end}${e.isNew ? " (Vorschlag)" : ""}`}
      className={`mb-0.5 rounded border px-1.5 py-0.5 text-xs leading-tight ${
        e.isNew
          ? "border-dashed border-emerald-500 bg-emerald-50 text-emerald-900"
          : "border-slate-300 bg-slate-100 text-slate-800"
      }`}
    >
      {e.noTime ? `${e.label} (Uhrzeit fehlt)` : `${e.start} ${e.label}`}
    </div>
  );
}

/** Alle künftigen Badtermine mit Nutzung, belegten Stunden und Trainerlage. */
export function TerminplanTab({ plan, onUpload }: { plan: Planning; onUpload: () => void }) {
  const { cfg, future, entriesOn, staffing, need, surveyed, nBlocks, typical } = plan;
  const { crewOn, team, setSlots, loadSlots } = plan.data;

  async function setMode(s: StoredSlot, v: string) {
    const mode = v === "std" ? null : (v as Mode);
    setSlots((all) => all.map((x) => (x.date === s.date ? { ...x, mode } : x)));
    const { error } = await db
      .from("pool_slots")
      .update({ mode })
      .eq("pool", cfg.id)
      .eq("slot_date", s.date);
    if (error) toast.error(error.message);
  }

  async function setModeMany(dates: string[], mode: Mode, okText: string) {
    if (!dates.length) return toast.info("Keine passenden Termine.");
    const { error } = await db
      .from("pool_slots")
      .update({ mode })
      .eq("pool", cfg.id)
      .in("slot_date", dates);
    if (error) return toast.error(error.message);
    toast.success(`${dates.length} ${okText}`);
    await loadSlots();
  }

  const markFirstOfMonth = () =>
    setModeMany(
      future.filter((s) => s.date.slice(8) <= "07" && s.mode !== "familie").map((s) => s.date),
      "familie",
      `Termine als Mitgliederschwimmen markiert`,
    );

  const blockUnderstaffed = () =>
    setModeMany(
      future
        .filter((s) => !s.closed && !skipReason(s))
        .filter((s) => {
          const st = staffing(s.date);
          return st.yes + st.unknown < need;
        })
        .map((s) => s.date),
      "entfaellt",
      "Termine gesperrt (zu wenige Trainer)",
    );

  if (!future.length)
    return (
      <div className="rounded-md border p-4 text-sm">
        Für das {cfg.name} gibt es noch keine Nutzungstermine.{" "}
        <Button size="sm" variant="outline" onClick={onUpload}>
          Badplan hochladen
        </Button>
      </div>
    );

  const counts = { blocked: 0, withCourses: 0, free: 0 };
  for (const s of future) {
    if (s.closed || skipReason(s)) counts.blocked++;
    else if ((entriesOn[s.date] ?? []).length) counts.withCourses++;
    else counts.free++;
  }

  const months = new Map<string, StoredSlot[]>();
  for (const s of future)
    months.set(s.date.slice(0, 7), [...(months.get(s.date.slice(0, 7)) ?? []), s]);

  function blockCell(s: StoredSlot, b: number) {
    if (!s.start) return null;
    const from = hourStart(s, b);
    const list = (entriesOn[s.date] ?? []).filter((e) => overlaps(e.start, e.end, from, from + 60));
    return (
      <td key={b} className="border-l p-1 align-top">
        <div className="mb-0.5 text-[10px] text-muted-foreground">{hhmm(from)}</div>
        {list.length ? (
          list.map((e, i) => <Chip key={`${e.label}${e.start}${i}`} e={e} />)
        ) : (
          <span className="text-xs text-emerald-700">frei</span>
        )}
      </td>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline">{future.length} Termine</Badge>
        <Badge variant="outline" className="text-emerald-700">
          {counts.free} frei
        </Badge>
        <Badge variant="outline">{counts.withCourses} mit Kursen</Badge>
        <Badge variant="outline">{counts.blocked} gesperrt</Badge>
        <span className="ml-auto flex flex-wrap gap-3 text-xs text-muted-foreground">
          {LEGEND.map(([cls, label]) => (
            <span key={label}>
              <span className={`mr-1 inline-block h-2.5 w-2.5 rounded ${cls}`} />
              {label}
            </span>
          ))}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={markFirstOfMonth}>
          Jeden 1. {cfg.dayName} im Monat = Mitgliederschwimmen
        </Button>
        {surveyed && (
          <Button size="sm" variant="outline" onClick={blockUnderstaffed}>
            Termine ohne genug Trainer sperren
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="p-1.5 text-left">Termin</th>
              <th className="p-1.5 text-left">Badzeit</th>
              <th className="w-44 p-1.5 text-left">Nutzung</th>
              {Array.from({ length: nBlocks }, (_, b) => (
                <th key={b} className="border-l p-1.5 text-left">
                  {b + 1}. Stunde{typical?.start ? ` (${hhmm(hourStart(typical, b))})` : ""}
                </th>
              ))}
              <th className="border-l p-1.5 text-left">Trainer</th>
            </tr>
          </thead>
          {[...months].map(([m, list]) => (
            <tbody key={m}>
              <tr>
                <td colSpan={4 + nBlocks} className="bg-muted/50 px-1.5 py-1 text-xs font-semibold">
                  {monthLabel(`${m}-01`)}
                </td>
              </tr>
              {list.map((s) => {
                const reason = s.closed ? "Hallenbad geschlossen" : skipReason(s);
                const st = staffing(s.date);
                const crew = crewOn[s.date] ?? [];
                const trainerColor =
                  st.yes + st.unknown < need
                    ? "text-red-600 font-semibold"
                    : st.yes < need
                      ? "text-amber-700"
                      : "text-emerald-700";
                return (
                  <tr key={s.date} className={`border-b align-top ${reason ? "bg-muted/40" : ""}`}>
                    <td className="whitespace-nowrap p-1.5 font-medium">{fmt(s.date)}</td>
                    <td className="whitespace-nowrap p-1.5 text-xs">
                      {time(s)}
                      {s.note && (
                        <div className="max-w-[10rem] text-[10px] text-muted-foreground">
                          {s.note}
                        </div>
                      )}
                    </td>
                    <td className="p-1">
                      {s.closed ? (
                        <span className="text-xs">Bad geschlossen</span>
                      ) : (
                        <Select value={s.mode ?? "std"} onValueChange={(v) => setMode(s, v)}>
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(MODE_LABEL).map(([v, l]) => (
                              <SelectItem key={v} value={v}>
                                {v === "std" && holidayName(s.date) ? `Feiertag – entfällt` : l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    {reason ? (
                      <td
                        colSpan={nBlocks}
                        className="border-l p-1.5 text-xs text-muted-foreground"
                      >
                        {reason}
                      </td>
                    ) : (
                      Array.from({ length: nBlocks }, (_, b) => blockCell(s, b))
                    )}
                    <td className="min-w-[12rem] border-l p-1.5 text-xs">
                      {crew.map((c, i) => {
                        const names = c.ids.map((id) => team.find((m) => m.id === id)?.name ?? "?");
                        const gap = Math.max(0, c.needed - c.ids.length);
                        return (
                          <div key={`${c.name}${i}`} className="mb-0.5 leading-tight">
                            <span className="text-muted-foreground">{c.name}: </span>
                            {names.length ? names.join(", ") : "niemand"}
                            {gap > 0 && (
                              <span className="font-semibold text-red-600"> – {gap} fehlt</span>
                            )}
                          </div>
                        );
                      })}
                      {!reason && surveyed && (
                        <div className={trainerColor}>
                          Abfrage: {st.yes} zu · {st.unknown} offen
                        </div>
                      )}
                      {!crew.length && (reason || !surveyed) && "–"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </>
  );
}
