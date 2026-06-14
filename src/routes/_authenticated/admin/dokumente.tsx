import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Download, Trash2, Upload, Plus } from "lucide-react";
import { formatDateBerlin } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/dokumente")({
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

const VISIBILITY_OPTIONS = [
  { value: "public", label: "Öffentlich" },
  { value: "members", label: "Mitglieder" },
  { value: "trainers", label: "Trainer:innen" },
  { value: "admin", label: "Admin" },
];

function emptyDoc(): Partial<Doc> {
  return { title: "", description: "", version: "", visibility: "members", file_url: "" };
}

function Page() {
  const [rows, setRows] = useState<Doc[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Doc>>(emptyDoc());
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const { data } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
    setRows((data as Doc[]) || []);
  }
  useEffect(() => { load(); }, []);

  function startNew() { setEditing(emptyDoc()); setOpen(true); }
  function startEdit(d: Doc) { setEditing(d); setOpen(true); }

  async function uploadFile(file: File): Promise<string | null> {
    setUploading(true);
    const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error } = await supabase.storage.from("documents").upload(path, file, { upsert: false });
    setUploading(false);
    if (error) { toast.error(error.message); return null; }
    return path;
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const path = await uploadFile(f);
    if (path) {
      setEditing(prev => ({ ...prev, file_url: path, title: prev.title || f.name.replace(/\.[^.]+$/, "") }));
      toast.success("Datei hochgeladen");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save() {
    if (!editing.title) return toast.error("Titel erforderlich");
    const payload = {
      title: editing.title,
      description: editing.description || null,
      version: editing.version || null,
      visibility: editing.visibility || "members",
      file_url: editing.file_url || null,
    };
    const res = editing.id
      ? await supabase.from("documents").update(payload).eq("id", editing.id)
      : await supabase.from("documents").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Gespeichert");
    setOpen(false);
    await load();
  }

  async function remove(d: Doc) {
    if (!confirm(`Dokument "${d.title}" löschen?`)) return;
    if (d.file_url) await supabase.storage.from("documents").remove([d.file_url]);
    const { error } = await supabase.from("documents").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Gelöscht");
    await load();
  }

  async function download(d: Doc) {
    if (!d.file_url) return toast.error("Keine Datei verknüpft");
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.file_url, 60);
    if (error || !data) return toast.error(error?.message || "Fehler");
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary-deep">Dokumentenverwaltung</h1>
          <p className="text-muted-foreground mt-1 text-sm">Satzung, Formulare und interne Unterlagen.</p>
        </div>
        <Button onClick={startNew}><Plus className="h-4 w-4" /> Neues Dokument</Button>
      </div>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Sichtbarkeit</TableHead>
                <TableHead>Datei</TableHead>
                <TableHead>Aktualisiert</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Noch keine Dokumente.</TableCell></TableRow>}
              {rows.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.title}{d.description && <div className="text-xs text-muted-foreground">{d.description}</div>}</TableCell>
                  <TableCell className="text-xs">{d.version || "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{VISIBILITY_OPTIONS.find(o => o.value === d.visibility)?.label || d.visibility}</Badge></TableCell>
                  <TableCell>{d.file_url ? <Button variant="ghost" size="sm" onClick={() => download(d)}><Download className="h-4 w-4" /></Button> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateBerlin(d.created_at)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(d)}>Bearbeiten</Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(d)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing.id ? "Dokument bearbeiten" : "Neues Dokument"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Titel *</Label><Input value={editing.title || ""} onChange={e => setEditing(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Beschreibung</Label><Textarea rows={3} value={editing.description || ""} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Version</Label><Input value={editing.version || ""} onChange={e => setEditing(p => ({ ...p, version: e.target.value }))} placeholder="z.B. 1.0" /></div>
              <div>
                <Label>Sichtbarkeit</Label>
                <Select value={editing.visibility} onValueChange={(v: any) => setEditing(p => ({ ...p, visibility: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VISIBILITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Datei</Label>
              <div className="flex items-center gap-2">
                <Input ref={fileRef} type="file" onChange={onPickFile} disabled={uploading} />
                {editing.file_url && <Badge variant="secondary" className="text-xs"><Upload className="h-3 w-3 mr-1" />hochgeladen</Badge>}
              </div>
              {editing.file_url && <div className="text-xs text-muted-foreground mt-1 truncate">{editing.file_url}</div>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={uploading}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
