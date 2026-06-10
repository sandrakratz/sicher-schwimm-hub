import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/news")({
  component: Page,
});

const VISIBILITY_LABEL: Record<string, string> = {
  public: "Öffentlich",
  members: "Mitglieder",
  trainers: "Trainer:innen",
  admin: "Admin",
};

type News = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  category: string;
  visibility: "public" | "members" | "trainers" | "admin";
  published: boolean;
  published_at: string | null;
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[äöüß]/g, m => ({ä:"ae",ö:"oe",ü:"ue",ß:"ss"}[m] || m)).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function Page() {
  const [rows, setRows] = useState<News[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<News>>({});

  async function load() {
    const { data } = await supabase.from("news").select("*").order("created_at", { ascending: false });
    setRows((data as News[]) || []);
  }
  useEffect(() => { load(); }, []);

  function startNew() { setEditing({ category: "general", visibility: "public", published: false, content: "" }); setOpen(true); }
  function startEdit(n: News) { setEditing(n); setOpen(true); }

  async function save() {
    if (!editing.title || !editing.content) return toast.error("Titel und Inhalt erforderlich");
    const publish = !!editing.published;
    const payload: any = {
      title: editing.title,
      slug: editing.slug || slugify(editing.title),
      excerpt: editing.excerpt || null,
      content: editing.content,
      category: editing.category || "general",
      visibility: editing.visibility || "public",
      published: publish,
      published_at: publish ? (editing.published_at || new Date().toISOString()) : null,
    };
    const res = editing.id
      ? await supabase.from("news").update(payload).eq("id", editing.id)
      : await supabase.from("news").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Gespeichert");
    setOpen(false);
    await load();
  }

  async function remove(n: News) {
    if (!confirm(`Beitrag "${n.title}" löschen?`)) return;
    const { error } = await supabase.from("news").delete().eq("id", n.id);
    if (error) return toast.error(error.message);
    toast.success("Gelöscht"); await load();
  }

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary-deep">News-Verwaltung</h1>
          <p className="text-muted-foreground mt-1 text-sm">Beiträge erstellen, veröffentlichen und pflegen.</p>
        </div>
        <Button onClick={startNew}><Plus className="h-4 w-4" /> Neuer Beitrag</Button>
      </div>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Sichtbarkeit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Veröffentlicht</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Noch keine Beiträge.</TableCell></TableRow>}
              {rows.map(n => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium">{n.title}</TableCell>
                  <TableCell className="text-xs">{n.category}</TableCell>
                  <TableCell><Badge variant="secondary">{VISIBILITY_LABEL[n.visibility] || n.visibility}</Badge></TableCell>
                  <TableCell>{n.published ? <Badge className="bg-emerald-100 text-emerald-900">Veröffentlicht</Badge> : <Badge variant="secondary">Entwurf</Badge>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{n.published_at ? new Date(n.published_at).toLocaleDateString("de-DE") : "—"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(n)}>Bearbeiten</Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(n)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing.id ? "Beitrag bearbeiten" : "Neuer Beitrag"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Titel *</Label><Input value={editing.title || ""} onChange={e => setEditing(p => ({ ...p, title: e.target.value, slug: p.slug || slugify(e.target.value) }))} /></div>
              <div><Label>Slug</Label><Input value={editing.slug || ""} onChange={e => setEditing(p => ({ ...p, slug: e.target.value }))} /></div>
            </div>
            <div><Label>Kurzbeschreibung</Label><Textarea rows={2} value={editing.excerpt || ""} onChange={e => setEditing(p => ({ ...p, excerpt: e.target.value }))} /></div>
            <div><Label>Inhalt * (Markdown)</Label><Textarea rows={10} value={editing.content || ""} onChange={e => setEditing(p => ({ ...p, content: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Kategorie</Label><Input value={editing.category || ""} onChange={e => setEditing(p => ({ ...p, category: e.target.value }))} placeholder="general / event / kurs ..." /></div>
              <div>
                <Label>Sichtbarkeit</Label>
                <Select value={editing.visibility} onValueChange={(v: any) => setEditing(p => ({ ...p, visibility: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Öffentlich</SelectItem>
                    <SelectItem value="members">Mitglieder</SelectItem>
                    <SelectItem value="trainers">Trainer:innen</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!editing.published} onCheckedChange={v => setEditing(p => ({ ...p, published: !!v }))} /> Veröffentlichen</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
