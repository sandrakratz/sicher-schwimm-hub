import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/portal/dokumente")({
  component: Page,
});

type Doc = {
  id: string;
  title: string;
  description: string | null;
  file_url: string | null;
  version: string | null;
  visibility: "public" | "members" | "trainers" | "admin";
  created_at: string;
};

const VISIBILITY_LABEL: Record<string, string> = {
  public: "Öffentlich",
  members: "Mitglieder",
  trainers: "Trainer:innen",
  admin: "Admin",
};

function Page() {
  const [rows, setRows] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      setRows((data as Doc[]) || []);
      setLoading(false);
    })();
  }, []);

  async function download(d: Doc) {
    if (!d.file_url) return toast.error("Keine Datei verknüpft");
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.file_url, 60);
    if (error || !data) return toast.error(error?.message || "Fehler");
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary-deep">Dokumente</h1>
        <p className="text-muted-foreground mt-1 text-sm">Satzung, Mitgliedsordnung, Formulare und interne Unterlagen.</p>
      </div>
      <Card className="border-0 shadow-soft">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Sichtbarkeit</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Lade…</TableCell></TableRow>}
              {!loading && rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Keine Dokumente verfügbar.</TableCell></TableRow>}
              {rows.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    {d.title}
                    {d.description && <div className="text-xs text-muted-foreground">{d.description}</div>}
                  </TableCell>
                  <TableCell className="text-xs">{d.version || "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{VISIBILITY_LABEL[d.visibility] || d.visibility}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString("de-DE")}</TableCell>
                  <TableCell className="text-right">
                    {d.file_url && (
                      <Button variant="ghost" size="sm" onClick={() => download(d)}>
                        <Download className="h-4 w-4 mr-1" /> Download
                      </Button>
                    )}
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
