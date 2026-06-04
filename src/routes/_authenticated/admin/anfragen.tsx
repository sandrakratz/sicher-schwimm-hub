import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Item = { id: string; parent_name: string; parent_email: string; child_name: string | null; desired_course: string | null; status: string; created_at: string };

export const Route = createFileRoute("/_authenticated/admin/anfragen")({
  component: AnfragenAdmin,
});

function AnfragenAdmin() {
  const [rows, setRows] = useState<Item[]>([]);
  async function load() {
    const { data } = await supabase.from("course_requests").select("*").order("created_at", { ascending: false });
    setRows(data || []);
  }
  useEffect(() => { load(); }, []);
  async function setStatus(id: string, status: "new" | "contacted" | "accepted" | "rejected" | "under_review" | "waiting_list") {
    const { error } = await supabase.from("course_requests").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Aktualisiert"); load(); }
  }
  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-3xl font-bold text-primary-deep mb-6">Kursanfragen</h1>
      <Card className="border-0 shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Eltern</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Kurs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Noch keine Anfragen.</TableCell></TableRow>}
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("de-DE")}</TableCell>
                  <TableCell>
                    <div className="font-semibold">{r.parent_name}</div>
                    <div className="text-xs text-muted-foreground">{r.parent_email}</div>
                  </TableCell>
                  <TableCell>{r.child_name || "—"}</TableCell>
                  <TableCell>{r.desired_course || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                  <TableCell className="space-x-1">
                    <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "contacted")}>Kontaktiert</Button>
                    <Button size="sm" variant="accent" onClick={() => setStatus(r.id, "accepted")}>Akzeptieren</Button>
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
