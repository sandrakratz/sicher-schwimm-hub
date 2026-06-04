import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/mitgliedschaften")({
  component: Page,
});

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  async function load() {
    const { data } = await supabase.from("memberships").select("*").order("created_at", { ascending: false });
    setRows(data || []);
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: "pending" | "active" | "suspended" | "terminated") {
    const { error } = await supabase.from("memberships").update({ status, approved_at: status === "active" ? new Date().toISOString() : null }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Aktualisiert"); load(); }
  }
  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-3xl font-bold text-primary-deep mb-6">Mitgliedschaften</h1>
      <Card className="border-0 shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Datum</TableHead><TableHead>Name</TableHead><TableHead>E-Mail</TableHead><TableHead>Art</TableHead><TableHead>Status</TableHead><TableHead>Aktionen</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Keine Anträge.</TableCell></TableRow>}
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("de-DE")}</TableCell>
                  <TableCell>{r.first_name} {r.last_name}</TableCell>
                  <TableCell className="text-xs">{r.email}</TableCell>
                  <TableCell><Badge variant="outline">{r.membership_type}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                  <TableCell className="space-x-1">
                    <Button size="sm" variant="accent" onClick={() => setStatus(r.id, "active")}>Genehmigen</Button>
                    <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "terminated")}>Ablehnen</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
