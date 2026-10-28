import { useMemo, useState } from "react";
import { PhoneIncoming, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addDays, gapOf, indexPlan, longDate, timeText, type PlanData } from "@/lib/dienstplan";
import { todayBerlinIso } from "@/lib/format";

/** Alle Termine, bei denen noch jemand fehlt – chronologisch über alle Kurse. */
export function GapList({
  data,
  onPick,
  onWithdrawal,
}: {
  data: PlanData;
  onPick: (sessionId: string) => void;
  onWithdrawal: () => void;
}) {
  const today = todayBerlinIso();
  const [days, setDays] = useState("42");
  const [q, setQ] = useState("");
  const ix = useMemo(() => indexPlan(data), [data]);

  const open = useMemo(() => {
    const limit = days === "all" ? "9999-12-31" : addDays(today, Number(days));
    const needle = q.trim().toLowerCase();
    return data.sessions
      .filter((s) => s.date >= today && s.date <= limit && gapOf(ix, s) > 0)
      .filter(
        (s) =>
          !needle ||
          `${s.courseName} ${s.location ?? ""}`.toLowerCase().includes(needle) ||
          [...(ix.teamBySession.get(s.id) ?? [])].some((id) =>
            (ix.trainerById.get(id)?.name ?? "").toLowerCase().includes(needle),
          ),
      )
      .sort((a, b) => (a.date + (a.start ?? "")).localeCompare(b.date + (b.start ?? "")));
  }, [data.sessions, ix, today, days, q]);

  const byDay = useMemo(() => {
    const map = new Map<string, typeof open>();
    for (const s of open) map.set(s.date, [...(map.get(s.date) ?? []), s]);
    return [...map.entries()];
  }, [open]);

  const empty = open.filter((s) => (ix.teamBySession.get(s.id)?.size ?? 0) === 0).length;
  const missingTotal = open.reduce((n, s) => n + gapOf(ix, s), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{open.length}</div>
            <div className="text-xs text-muted-foreground">Termine mit Lücke</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{missingTotal}</div>
            <div className="text-xs text-muted-foreground">Fehlende Trainer:innen insgesamt</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className={`text-2xl font-bold ${empty ? "text-destructive" : ""}`}>{empty}</div>
            <div className="text-xs text-muted-foreground">Termine ganz ohne Trainer:in</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onWithdrawal}>
          <PhoneIncoming className="h-4 w-4" /> Absage erfassen
        </Button>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="14">Nächste 2 Wochen</SelectItem>
            <SelectItem value="42">Nächste 6 Wochen</SelectItem>
            <SelectItem value="90">Nächste 3 Monate</SelectItem>
            <SelectItem value="all">Alle kommenden</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="w-64 pl-8"
            placeholder="Kurs, Ort oder Person…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {byDay.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            ✓ Im gewählten Zeitraum sind alle Termine voll besetzt.
          </CardContent>
        </Card>
      )}

      {byDay.map(([day, list]) => (
        <div key={day}>
          <div className="mb-1.5 text-sm font-semibold">
            {longDate(day)}
            {day === today && <Badge className="ml-2">heute</Badge>}
          </div>
          <div className="space-y-2">
            {list.map((s) => {
              const team = [...(ix.teamBySession.get(s.id) ?? [])];
              const gap = gapOf(ix, s);
              return (
                <div
                  key={s.id}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border p-3 ${
                    team.length === 0
                      ? "border-destructive/50 bg-destructive/5"
                      : "border-amber-400/60"
                  }`}
                >
                  <span className="w-28 shrink-0 text-sm font-medium tabular-nums">
                    {timeText(s)}
                  </span>
                  <div className="min-w-48 flex-1">
                    <div className="font-medium">
                      {s.courseName}{" "}
                      <span className="text-xs text-muted-foreground">· {s.index}. Termin</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.location ? `${s.location} · ` : ""}
                      eingeteilt:{" "}
                      {team.length
                        ? team.map((id) => ix.trainerById.get(id)?.name ?? "?").join(", ")
                        : "niemand"}
                    </div>
                  </div>
                  <Badge variant="outline" className="border-destructive text-destructive">
                    {team.length}/{s.needed} · {gap} fehlt
                  </Badge>
                  {s.replacementRequestedAt && (
                    <Badge variant="secondary" title="Ersatz wurde per Mail angefragt">
                      angefragt{" "}
                      {new Date(s.replacementRequestedAt).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </Badge>
                  )}
                  <a
                    href={`/admin/kalender?kurs=${s.courseId}`}
                    className="text-xs text-primary underline-offset-2 hover:underline"
                    title="Alle Termine dieses Kurses einteilen"
                  >
                    Ganzen Kurs bearbeiten
                  </a>
                  <Button size="sm" onClick={() => onPick(s.id)}>
                    Besetzen
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
