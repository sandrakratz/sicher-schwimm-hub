import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Gift, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateBerlin } from "@/lib/format";
import { listUpcomingBirthdays, sendBirthdayGreeting } from "@/lib/reports.functions";

export const BIRTHDAYS_QUERY_KEY = ["upcoming-birthdays"] as const;

export function useBirthdays() {
  return useQuery({
    queryKey: BIRTHDAYS_QUERY_KEY,
    queryFn: () => listUpcomingBirthdays(),
    staleTime: 10 * 60 * 1000,
  });
}

function when(inTagen: number) {
  if (inTagen === 0) return "heute";
  if (inTagen === 1) return "morgen";
  if (inTagen < 0) return inTagen === -1 ? "gestern" : `vor ${-inTagen} Tagen`;
  return `in ${inTagen} Tagen`;
}

/** Geburtstage der Mitglieder (inkl. Kinder) mit Knopf „Glückwunsch senden“ – nichts geht automatisch raus. */
export function BirthdaysPanel({ onChanged }: { onChanged: () => void }) {
  const { data, isLoading, error } = useBirthdays();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  if (error)
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Geburtstage konnten nicht geladen werden."}
      </p>
    );
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Lädt …</p>;
  if (data.length === 0)
    return (
      <p className="text-sm text-muted-foreground">Keine Geburtstage in den nächsten 30 Tagen.</p>
    );

  async function greet(key: string) {
    setBusy(key);
    try {
      await sendBirthdayGreeting({ data: { key } });
      toast.success("Glückwunsch gesendet");
      await qc.invalidateQueries({ queryKey: BIRTHDAYS_QUERY_KEY });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Senden fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ul className="divide-y rounded-xl bg-card shadow-soft">
      {data.map((b) => (
        <li key={b.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="font-semibold">
              {b.name}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                · {b.rolle} · wird {b.wirdAlt}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {formatDateBerlin(b.tag)} ({when(b.inTagen)})
              {b.rolle === "Kind" ? " · Mail geht an die Eltern" : ""}
            </div>
          </div>
          {b.sentAt ? (
            <span className="flex items-center gap-1 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> gratuliert am {formatDateBerlin(b.sentAt)}
            </span>
          ) : !b.hasEmail ? (
            <span className="text-sm text-muted-foreground">keine E-Mail hinterlegt</span>
          ) : b.inTagen > 0 ? (
            <span className="text-sm text-muted-foreground">ab dem Geburtstag</span>
          ) : (
            <Button size="sm" disabled={busy === b.key} onClick={() => void greet(b.key)}>
              {busy === b.key ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Gift className="h-4 w-4" />
              )}
              Glückwunsch senden
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
