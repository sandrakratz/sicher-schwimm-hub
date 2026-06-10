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

export const Route = createFileRoute("/_authenticated/admin/kurse")({
  component: Page,
});

type Course = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  target_group: string | null;
  age_range: string | null;
  duration: string | null;
  location: string | null;
  status: "planned" | "open" | "waiting_list" | "fully_booked" | "completed";
  max_participants: number | null;
  starts_on: string | null;
  ends_on: string | null;
  schedule: string | null;
  is_public: boolean;
};

const STATUS_OPTIONS = [
  { value: "planned", label: "Geplant" },
  { value: "open", label: "Offen" },
  { value: "waiting_list", label: "Warteliste" },
  { value: "fully_booked", label: "Ausgebucht" },
  { value: "completed", label: "Abgeschlossen" },
];
const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map(o => [o.value, o.label]));

function slugify(s: string) {
  return s.toLowerCase().replace(/[äöüß]/g, m => ({ä:"ae",ö:"oe",ü:"ue",ß:"ss"}[m] || m)).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function Page() {
  const [rows, setRows] = useState<Course[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Course>>({});

  async function load() {
    const { data } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
    setRows((data as Course[]) || []);
  }
  useEffect(() => { load(); }, []);

  function startNew() { setEditing({ status: "planned", is_public: true }); setOpen(true); }
  function startEdit(c: Course) { setEditing(c); setOpen(true); }

  async function save() {
    if (!editing.name) return toast.error("Name erforderlich");
    const payload: any = {
      name: editing.name,
      slug: editing.slug || slugify(editing.name),
      description: editing.description || null,
      target_group: editing.target_group || null,
      age_range: editing.age_range || null,
      duration: editing.duration || null,
      location: editing.location || null,
      status: editing.status || "planned",
      max_participants: editing.max_participants ?? null,
      starts_on: editing.starts_on || null,
      ends_on: editing.ends_on || null,
      schedule: editing.schedule || null,
      is_public: editing.is_public ?? true,
    };
    const res = editing.id
      ? await supabase.from("courses").update(payload).eq("id", editing.id)
      : await supabase.from("courses").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Gespeichert");
    setOpen(false);
    await load();
  }

  async function remove(c: Course) {
    if (!confirm(`Kurs "${c.name}" löschen?`)) return;
    const { error } = await supabase.from("courses").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Gelöscht"); await load();
  }

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary-deep">Kursverwaltung</h1>
          <p className="text-muted-foreground mt-1 text-sm">Schwimmkurse anlegen und verwalten.</p>
        </div>
        <Button onClick={startNew}><Plus className="h-4 w-4" /> Neuer Kurs</Button>
      </div>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Zielgruppe</TableHead>
                <TableHead>Zeitraum</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plätze</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Noch keine Kurse.</TableCell></TableRow>}
              {rows.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}{!c.is_public && <Badge variant="secondary" className="ml-2 text-xs">intern</Badge>}</TableCell>
                  <TableCell className="text-xs">{c.target_group || c.age_range || "—"}</TableCell>
                  <TableCell className="text-xs">{c.starts_on || "—"} – {c.ends_on || "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
                  <TableCell className="text-xs">{c.max_participants ?? "—"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(c)}>Bearbeiten</Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing.id ? "Kurs bearbeiten" : "Neuer Kurs"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name *</Label><Input value={editing.name || ""} onChange={e => setEditing(p => ({ ...p, name: e.target.value, slug: p.slug || slugify(e.target.value) }))} /></div>
              <div><Label>Slug</Label><Input value={editing.slug || ""} onChange={e => setEditing(p => ({ ...p, slug: e.target.value }))} /></div>
            </div>
            <div><Label>Beschreibung</Label><Textarea rows={3} value={editing.description || ""} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Zielgruppe</Label><Input value={editing.target_group || ""} onChange={e => setEditing(p => ({ ...p, target_group: e.target.value }))} /></div>
              <div><Label>Altersgruppe</Label><Input value={editing.age_range || ""} onChange={e => setEditing(p => ({ ...p, age_range: e.target.value }))} /></div>
              <div><Label>Dauer</Label><Input value={editing.duration || ""} onChange={e => setEditing(p => ({ ...p, duration: e.target.value }))} placeholder="z.B. 10 Wochen" /></div>
              <div><Label>Ort</Label><Input value={editing.location || ""} onChange={e => setEditing(p => ({ ...p, location: e.target.value }))} /></div>
              <div><Label>Start</Label><Input type="date" value={editing.starts_on || ""} onChange={e => setEditing(p => ({ ...p, starts_on: e.target.value || null }))} /></div>
              <div><Label>Ende</Label><Input type="date" value={editing.ends_on || ""} onChange={e => setEditing(p => ({ ...p, ends_on: e.target.value || null }))} /></div>
              <div><Label>Max. Plätze</Label><Input type="number" value={editing.max_participants ?? ""} onChange={e => setEditing(p => ({ ...p, max_participants: e.target.value ? Number(e.target.value) : null }))} /></div>
              <div>
                <Label>Status</Label>
                <Select value={editing.status} onValueChange={(v: any) => setEditing(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Zeitplan</Label><Input value={editing.schedule || ""} onChange={e => setEditing(p => ({ ...p, schedule: e.target.value }))} placeholder="z.B. Mo & Mi 17:00–18:00" /></div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={editing.is_public ?? true} onCheckedChange={v => setEditing(p => ({ ...p, is_public: !!v }))} /> Öffentlich sichtbar</label>
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
