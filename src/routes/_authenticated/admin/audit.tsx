import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTimeBerlin } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try { await assertHasAnyRole({ data: { roles: ["admin"] } }); }
    catch { throw redirect({ to: "/admin/benutzer" }); }
  },
  component: Page,
});

type LogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const PAGE = 100;

/** Kurzform der Zusatzangaben (ohne personenbezogene Details auszuschreiben). */
function metaText(m: LogRow["metadata"]): string {
  if (!m || typeof m !== "object") return "";
  return Object.entries(m)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

function Page() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore(offset: number) {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("audit_logs")
      .select("id,actor_id,action,entity,entity_id,metadata,created_at")
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + PAGE - 1);
    if (err) { setError(err.message); setLoading(false); return; }
    const list = ((data as unknown as LogRow[]) || []);
    setRows(prev => (offset === 0 ? list : [...prev, ...list]));
    setHasMore(list.length === PAGE);
    // Namen der handelnden Personen nachladen
    const missing = [...new Set(list.map(r => r.actor_id).filter((id): id is string => !!id))];
    if (missing.length) {
      const { data: profs } = await supabase.from("profiles").select("id,first_name,last_name,email").in("id", missing.slice(0, 100));
      setNames(prev => {
        const next = { ...prev };
        (profs || []).forEach((p: { id: string; first_name: string | null; last_name: string | null; email: string }) => {
          next[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email;
        });
        return next;
      });
    }
    setLoading(false);
  }
  useEffect(() => { void loadMore(0); }, []);

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-3xl font-bold text-primary-deep mb-6">Audit-Log</h1>
      <Card className="border-0 shadow-soft">
        <CardContent className="p-6">
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          {rows.length === 0 && !loading ? <p className="text-center text-muted-foreground py-10">Noch keine Einträge.</p> : (
            <ul className="divide-y">
              {rows.map(r => (
                <li key={r.id} className="py-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span><strong>{r.action}</strong> · {r.entity}{r.entity_id ? <span className="text-muted-foreground"> ({r.entity_id.slice(0, 8)}…)</span> : null}</span>
                    <span className="text-muted-foreground text-xs">{formatDateTimeBerlin(r.created_at)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    von {r.actor_id ? (names[r.actor_id] ?? "…") : "System"}
                    {metaText(r.metadata) ? ` · ${metaText(r.metadata)}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {loading && <p className="py-4 text-center text-sm text-muted-foreground">Lade …</p>}
          {!loading && hasMore && (
            <div className="pt-4 text-center">
              <Button variant="outline" onClick={() => void loadMore(rows.length)}>Weitere {PAGE} laden</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
