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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { formatDateTimeBerlin } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/events")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/admin-guard.functions");
    const { redirect } = await import("@tanstack/react-router");
    try { await assertHasAnyRole({ data: { roles: ["admin", "board"] } }); }
    catch { throw redirect({ to: "/admin/benutzer" }); }
  },
  component: Page,
});

const VISIBILITY_LABEL: Record<string, string> = {
  public: "Öffentlich",
  members: "Mitglieder",
  trainers: "Trainer:innen",
  admin: "Admin",
};

type Ev = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  visibility: "public" | "members" | "trainers" | "admin";
};

function toLocal(s?: string | null) {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function fromLocal(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function Page() {
  const [rows, setRows] = useState<Ev[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Ev>>({});

  async function load() {
    const { data } = await supabase.from("events").select("*").order("starts_at", { ascending: false });
    setRows((data as Ev[]) || []);
  }
  useEffect(() => { load(); }, []);

  function startNew() { setEditing({ visibility: "public", starts_at: new Date().toISOString() }); setOpen(true); }
  function startEdit(e: Ev) { setEditing(e); setOpen(true); }

  async function save() {
    if (!editing.title || !editing.starts_at) return toast.error("Titel und Startzeit erforderlich");
    const payload = {
      title: editing.title,
      description: editing.description || null,
      location: editing.location || null,
      starts_at: editing.starts_at,
      ends_at: editing.ends_at || null,
      visibility: editing.visibility || "public",
    };
    const res = editing.id
      ? await supabase.from("events").update(payload).eq("id", editing.id)
      : await supabase.from("events").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Gespeichert");
    setOpen(false);
    await load();
  }

  async function remove(e: Ev) {
    if (!confirm(`Event "${e.title}" löschen?`)) return;
    const { error } = await supabase.from("events").delete().eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success("Gelöscht"); await load();
  }

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary-deep">Eventverwaltung</h1>
          <p className="text-muted-foreground mt-1 text-sm">Termine, Wettkämpfe und Veranstaltungen.</p>
        </div>
        <Button onClick={startNew}><Plus className="h-4 w-4" /> Neues Event</Button>
      </div>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Ort</TableHead>
                <TableHead>Sichtbarkeit</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Noch keine Events.</TableCell></TableRow>}
              {rows.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.title}</TableCell>
                  <TableCell className="text-sm">{formatDateTimeBerlin(e.starts_at)}</TableCell>
                  <TableCell className="text-sm">{e.location || "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{VISIBILITY_LABEL[e.visibility] || e.visibility}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(e)}>Bearbeiten</Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(e)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing.id ? "Event bearbeiten" : "Neues Event"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Titel *</Label><Input value={editing.title || ""} onChange={e => setEditing(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Beschreibung</Label><Textarea rows={3} value={editing.description || ""} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} /></div>
            <div><Label>Ort</Label><Input value={editing.location || ""} onChange={e => setEditing(p => ({ ...p, location: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start *</Label><Input type="datetime-local" value={toLocal(editing.starts_at)} onChange={e => setEditing(p => ({ ...p, starts_at: new Date(e.target.value).toISOString() }))} /></div>
              <div><Label>Ende</Label><Input type="datetime-local" value={toLocal(editing.ends_at)} onChange={e => setEditing(p => ({ ...p, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} /></div>
            </div>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
