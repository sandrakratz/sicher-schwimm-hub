import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { listDienstplanLog, type DienstplanLogRow } from "@/lib/dienstplan.functions";
import { formatDateBerlin, formatDateTimeBerlin } from "@/lib/format";

const ACTIONS: Record<string, string> = {
  assigned: "eingeteilt",
  unassigned: "ausgeteilt",
  withdrawn: "hat selbst abgesagt",
  withdrawn_by_staff: "Absage vom Vorstand erfasst",
  claimed: "hat Ersatz übernommen",
  replacement_requested: "Ersatz angefragt",
};

/** Wer hat wann wen ein- oder ausgeteilt – und warum. */
export function PlanLog({ reloadKey }: { reloadKey: number }) {
  const load = useServerFn(listDienstplanLog);
  const [rows, setRows] = useState<DienstplanLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    setError(null);
    load({ data: { limit: 500 } })
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Protokoll nicht ladbar"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows ?? [];
    return (rows ?? []).filter((r) =>
      [r.trainerName, r.actorName, r.sessionLabel, r.reason, ACTIONS[r.action]]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [rows, q]);

  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (!rows) return <div className="text-sm text-muted-foreground">Protokoll wird geladen…</div>;

  return (
    <div className="space-y-3">
      <Input
        className="w-72"
        placeholder="Suche (Person, Kurs, Grund)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">Noch keine Einträge.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="p-1.5">Wann</th>
                <th className="p-1.5">Wer</th>
                <th className="p-1.5">Was</th>
                <th className="p-1.5">Termin</th>
                <th className="p-1.5">Grund / Hinweis</th>
                <th className="p-1.5">Durch</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="whitespace-nowrap p-1.5 text-xs">
                    {formatDateTimeBerlin(r.createdAt)}
                  </td>
                  <td className="p-1.5 font-medium">{r.trainerName ?? "–"}</td>
                  <td className="p-1.5">{ACTIONS[r.action] ?? r.action}</td>
                  <td className="p-1.5">
                    {r.sessionLabel ?? "–"}
                    {r.sessionDate ? ` · ${formatDateBerlin(r.sessionDate)}` : ""}
                  </td>
                  <td className="p-1.5">{r.reason ?? ""}</td>
                  <td className="p-1.5 text-xs text-muted-foreground">{r.actorName ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
