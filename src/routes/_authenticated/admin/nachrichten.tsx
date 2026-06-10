import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/nachrichten")({
  component: Page,
});

const STATUS_LABEL: Record<string, string> = {
  new: "Neu",
  read: "Gelesen",
  replied: "Beantwortet",
  archived: "Archiviert",
};

const CATEGORY_LABEL: Record<string, string> = {
  general: "Allgemein",
  membership: "Mitgliedschaft",
  course: "Kurs",
  feedback: "Feedback",
  complaint: "Beschwerde",
  other: "Sonstiges",
};

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("messages").select("*").order("created_at", { ascending: false }).then(({ data }) => setRows(data || []));
  }, []);
  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-3xl font-bold text-primary-deep mb-6">Nachrichten</h1>
      <Card className="border-0 shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Datum</TableHead><TableHead>Von</TableHead><TableHead>Kategorie</TableHead><TableHead>Betreff</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Keine Nachrichten.</TableCell></TableRow>}
              {rows.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs">{new Date(m.created_at).toLocaleDateString("de-DE")}</TableCell>
                  <TableCell><div className="font-semibold">{m.from_name}</div><div className="text-xs text-muted-foreground">{m.from_email}</div></TableCell>
                  <TableCell><Badge variant="outline">{CATEGORY_LABEL[m.category] || m.category}</Badge></TableCell>
                  <TableCell>{m.subject || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{STATUS_LABEL[m.status] || m.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
