import { useEffect, useState } from "react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Badge } from "@/components/ui/badge";
import { formatDateBerlin } from "@/lib/format";
import { formatEuro } from "@/lib/trainer-billing";
import { getMyPayouts, getPayoutCertificate, type MyPayout } from "@/lib/trainer-billing.functions";
import { openCertificate } from "@/lib/trainer-certificate";
import { Printer } from "lucide-react";
import { toast } from "sonner";

/** „Meine Auszahlungen“: was dem Trainer / der Trainerin im gewählten Jahr überwiesen wurde. */
export function MyPayouts() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [payouts, setPayouts] = useState<MyPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoading(true);
    getMyPayouts({ data: { year } })
      .then((res) => {
        setPayouts(res.payouts);
        setFailed(false);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [year]);

  const total = payouts.reduce((s, p) => s + p.total, 0);

  async function printCertificate() {
    try {
      const cert = await getPayoutCertificate({ data: { year } });
      if (!openCertificate(cert)) toast.error("Bitte Pop-ups für diese Seite erlauben.");
    } catch {
      toast.error("Bescheinigung konnte nicht erstellt werden.");
    }
  }

  return (
    <CollapsibleCard
      storageKey="trainer-home-payouts"
      defaultOpen={false}
      className="border-0 shadow-soft"
      title="Meine Auszahlungen"
      subtitle="Was dir der Verein überwiesen hat"
      meta={<Badge variant="secondary">{formatEuro(total)}</Badge>}
    >
      <div className="mb-3 flex items-center gap-2 text-sm">
        <button
          type="button"
          className="rounded-md border px-2 py-1"
          onClick={() => setYear((y) => y - 1)}
          aria-label="Vorjahr"
        >
          ‹
        </button>
        <span className="font-semibold">{year}</span>
        <button
          type="button"
          className="rounded-md border px-2 py-1 disabled:opacity-40"
          disabled={year >= thisYear}
          onClick={() => setYear((y) => y + 1)}
          aria-label="Folgejahr"
        >
          ›
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Wird geladen …</p>
      ) : failed ? (
        <p className="text-sm text-muted-foreground">Auszahlungen konnten nicht geladen werden.</p>
      ) : payouts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Für {year} wurde noch nichts ausgezahlt.</p>
      ) : (
        <div className="space-y-3">
          {payouts.map((p) => (
            <details key={p.id} className="rounded-md border bg-card">
              <summary className="flex cursor-pointer items-center justify-between gap-3 p-3 text-sm">
                <span>Überwiesen am {formatDateBerlin(p.paidOn)}</span>
                <span className="font-semibold">{formatEuro(p.total)}</span>
              </summary>
              <div className="divide-y border-t">
                {p.items.length === 0 && (
                  <div className="p-3 text-xs text-muted-foreground">
                    {p.note ?? "Nachträglich erfasst"}
                  </div>
                )}
                {p.items.map((i, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 p-3 text-xs">
                    <span>
                      {formatDateBerlin(i.sessionDate)} · {i.courseName}
                    </span>
                    <span className="text-muted-foreground">
                      {i.hours} Std. × {formatEuro(i.rate)} = {formatEuro(i.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Summe {year}: {formatEuro(total)}
            </p>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium"
              onClick={printCertificate}
            >
              <Printer className="h-3.5 w-3.5" /> Jahresbescheinigung {year}
            </button>
          </div>
        </div>
      )}
    </CollapsibleCard>
  );
}
