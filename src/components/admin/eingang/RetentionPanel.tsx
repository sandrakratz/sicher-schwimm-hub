import { useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateBerlin } from "@/lib/format";
import { runRetentionDryRun } from "@/lib/retention.functions";
import { RETENTION_LABELS, RETENTION_SCHEDULE_SQL } from "@/lib/retention-2027";

/**
 * Eingang: Löschjob prüfen und einplanen (Löschkonzept 2027). Der Probelauf ändert nichts und zeigt
 * nur Anzahlen. Eingeplant wird bewusst von Hand im Supabase-SQL-Editor.
 */
export function RetentionPanel() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ counts: Record<string, number>; stand: string } | null>(
    null,
  );

  async function run() {
    setBusy(true);
    try {
      setResult(await runRetentionDryRun());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Probelauf fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function copySql() {
    try {
      await navigator.clipboard.writeText(RETENTION_SCHEDULE_SQL);
      toast.success("SQL kopiert");
    } catch {
      toast.error("Kopieren nicht möglich – bitte den Text markieren und kopieren.");
    }
  }

  const total = result ? Object.values(result.counts).reduce((s, n) => s + n, 0) : 0;

  return (
    <div className="space-y-4 text-sm">
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Probelauf starten. Er zählt nur, was der Löschjob heute löschen würde, und ändert nichts.
        </li>
        <li>Zahlen prüfen: Passen sie ungefähr zu dem, was seit über 6 Monaten erledigt ist?</li>
        <li>
          Wenn ja: den Löschjob im Supabase-SQL-Editor einplanen (SQL unten). Danach läuft er
          täglich nachts, jeder Lauf steht im Änderungsprotokoll, und diese Aufgabe verschwindet.
        </li>
      </ol>

      <Button onClick={() => void run()} disabled={busy}>
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Play className="h-4 w-4" aria-hidden="true" />
        )}
        Probelauf starten
      </Button>

      {result && (
        <div className="space-y-2">
          <p className="font-medium">
            Probelauf vom {result.stand ? formatDateBerlin(result.stand) : "heute"}: {total}{" "}
            Einträge wären betroffen.
          </p>
          <ul className="divide-y rounded-xl bg-card shadow-soft">
            {RETENTION_LABELS.map(([key, label]) => (
              <li key={key} className="flex justify-between gap-3 px-3 py-1.5">
                <span>{label}</span>
                <span
                  className={`tabular-nums ${result.counts[key] ? "font-semibold" : "text-muted-foreground"}`}
                >
                  {result.counts[key] ?? 0}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">SQL zum Einplanen (Supabase → SQL-Editor):</p>
        <div className="flex items-start gap-2">
          <code className="block flex-1 select-all break-all rounded bg-muted p-2 text-xs">
            {RETENTION_SCHEDULE_SQL}
          </code>
          <Button size="sm" variant="outline" onClick={() => void copySql()}>
            <Copy className="h-4 w-4" aria-hidden="true" /> Kopieren
          </Button>
        </div>
      </div>
    </div>
  );
}
