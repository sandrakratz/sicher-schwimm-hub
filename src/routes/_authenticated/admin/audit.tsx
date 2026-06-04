import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: Page,
});

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100).then(({ data }) => setRows(data || []));
  }, []);
  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-3xl font-bold text-primary-deep mb-6">Audit-Log</h1>
      <Card className="border-0 shadow-soft">
        <CardContent className="p-6">
          {rows.length === 0 ? <p className="text-center text-muted-foreground py-10">Noch keine Einträge.</p> : (
            <ul className="divide-y">
              {rows.map(r => (
                <li key={r.id} className="py-3 text-sm flex justify-between">
                  <span><strong>{r.action}</strong> · {r.entity}</span>
                  <span className="text-muted-foreground text-xs">{new Date(r.created_at).toLocaleString("de-DE")}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
