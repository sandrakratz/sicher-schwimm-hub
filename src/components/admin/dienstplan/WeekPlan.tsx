import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addDays,
  blackoutOn,
  blackoutText,
  indexPlan,
  mondayOf,
  overlaps,
  shortDate,
  WEEKDAY_SHORT,
  type PlanData,
  type PlanSession,
} from "@/lib/dienstplan";
import { todayBerlinIso } from "@/lib/format";

function monthName(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString("de-DE", {
    month: "long",
    year: "2-digit",
  });
}

/** Trainer:innen × Wochentage: wer ist wann eingeteilt, wer gesperrt, wo gibt es Doppelbelegungen? */
export function WeekPlan({ data }: { data: PlanData }) {
  const today = todayBerlinIso();
  const [monday, setMonday] = useState(mondayOf(today));
  const ix = useMemo(() => indexPlan(data), [data]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const sessionsOn = (d: string) =>
    data.sessions
      .filter((s) => s.date === d)
      .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));

  const months = useMemo(() => {
    const base = today.slice(0, 7);
    const [y, m] = base.split("-").map(Number);
    return [0, 1, 2].map((i) => {
      const d = new Date(y!, (m ?? 1) - 1 + i, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
  }, [today]);

  const chip = (s: PlanSession, cls: string, title: string) => (
    <div key={s.id} title={title} className={`mb-0.5 rounded px-1 py-0.5 leading-tight ${cls}`}>
      {s.start ?? "?"} {s.courseName}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setMonday(addDays(monday, -7))}>
          <ChevronLeft className="h-4 w-4" /> Vorige Woche
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMonday(mondayOf(today))}>
          Diese Woche
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMonday(addDays(monday, 7))}>
          Nächste Woche <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          {shortDate(days[0]!)} – {shortDate(days[6]!)}
        </span>
        <span className="ml-auto flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-primary" />
            eingeteilt
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-green-200" />
            hat zugesagt
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-muted-foreground/30" />
            gesperrt
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-destructive" />
            Doppelbelegung
          </span>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background p-1.5 text-left">Trainer:in</th>
              {days.map((d, i) => (
                <th
                  key={d}
                  className={`border-l p-1.5 text-left font-semibold ${d === today ? "bg-primary/10" : ""}`}
                >
                  {WEEKDAY_SHORT[i]} {d.slice(8)}.{d.slice(5, 7)}.
                </th>
              ))}
            </tr>
            <tr className="border-t">
              <td className="sticky left-0 bg-background p-1.5 text-muted-foreground">
                Fehlt noch
              </td>
              {days.map((d) => {
                const missing = sessionsOn(d).reduce(
                  (n, s) => n + Math.max(0, s.needed - (ix.teamBySession.get(s.id)?.size ?? 0)),
                  0,
                );
                return (
                  <td
                    key={d}
                    className={`border-l p-1.5 font-semibold ${missing ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {missing ? `${missing} Lücke(n)` : sessionsOn(d).length ? "✓" : "–"}
                  </td>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.trainers.map((t) => (
              <tr key={t.id} className="border-t align-top">
                <td className="sticky left-0 whitespace-nowrap bg-background p-1.5 font-medium">
                  {t.name}
                </td>
                {days.map((d) => {
                  const block = blackoutOn(data.blackouts, t.id, d);
                  const daySessions = sessionsOn(d);
                  const mine = daySessions.filter((s) => ix.teamBySession.get(s.id)?.has(t.id));
                  const yes = daySessions.filter(
                    (s) =>
                      !ix.teamBySession.get(s.id)?.has(t.id) &&
                      ix.availBy.get(`${s.id}|${t.id}`) === true,
                  );
                  return (
                    <td
                      key={d}
                      className={`border-l p-1 ${block ? "bg-muted-foreground/20" : ""} ${d === today ? "bg-primary/5" : ""}`}
                      title={block ? `Gesperrt: ${blackoutText(block)}` : undefined}
                    >
                      {block && <div className="text-muted-foreground">gesperrt</div>}
                      {mine.map((s) => {
                        const clash = mine.some((o) => o.id !== s.id && overlaps(o, s));
                        const open = ix.unconfirmed.has(`${s.id}|${t.id}`);
                        return chip(
                          s,
                          `${
                            clash || block
                              ? "bg-destructive text-destructive-foreground"
                              : "bg-primary text-primary-foreground"
                          }${open ? " ring-2 ring-amber-300" : ""}`,
                          `${s.courseName}${s.location ? ` · ${s.location}` : ""}${clash ? " – Doppelbelegung!" : ""}${block ? " – in einer Sperrzeit!" : ""}${open ? " – noch nicht bestätigt" : ""}`,
                        );
                      })}
                      {yes.map((s) =>
                        chip(
                          s,
                          "bg-green-100 text-green-900",
                          `Hat für ${s.courseName} zugesagt, ist aber nicht eingeteilt`,
                        ),
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <div className="mb-1.5 text-sm font-semibold">Einsätze pro Monat (Auslastung)</div>
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                <th className="p-1.5 text-left">Trainer:in</th>
                {months.map((m) => (
                  <th key={m} className="p-1.5 text-right font-medium">
                    {monthName(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.trainers.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-1.5">{t.name}</td>
                  {months.map((m) => {
                    const n = (ix.sessionsByTrainer.get(t.id) ?? []).filter((s) =>
                      s.date.startsWith(m),
                    ).length;
                    return (
                      <td key={m} className="p-1.5 text-right tabular-nums">
                        {n || "–"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
