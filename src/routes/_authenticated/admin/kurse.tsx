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
import { Plus, Trash2, Users, Pencil, Award, Euro } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/kurse")({
  component: Page,
});

type Participant = {
  id: string;
  course_id: string;
  user_id: string | null;
  participant_name: string | null;
  participant_email: string | null;
  participant_phone: string | null;
  status: "confirmed" | "waiting" | "cancelled";
  notes: string | null;
  date_of_birth: string | null;
  goal_reached: boolean | null;
  achievement: string | null;
  badge: string | null;
  paid: boolean;
  paid_at: string | null;
  payment_note: string | null;
  is_member: boolean | null;
  member_confirmed: boolean;
  member_confirmed_at: string | null;
  price_amount: number | null;
  parent_user_id: string | null;
};


const ENROLL_STATUS = [
  { value: "confirmed", label: "Bestätigt" },
  { value: "waiting", label: "Warteliste" },
  { value: "cancelled", label: "Abgesagt" },
];
const ENROLL_STATUS_LABEL: Record<string, string> = Object.fromEntries(ENROLL_STATUS.map(o => [o.value, o.label]));

function ageAt(dobStr: string | null | undefined, refStr: string | null | undefined): number | null {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  const ref = refStr ? new Date(refStr) : new Date();
  if (isNaN(dob.getTime()) || isNaN(ref.getTime())) return null;
  let age = ref.getFullYear() - dob.getFullYear();
  const m = ref.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age--;
  return age;
}
function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("de-DE"); } catch { return s; }
}



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
  const [counts, setCounts] = useState<Record<string, { confirmed: number; waiting: number }>>({});
  const [partOpen, setPartOpen] = useState(false);
  const [partCourse, setPartCourse] = useState<Course | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newPart, setNewPart] = useState<{ name: string; email: string; phone: string; status: "confirmed" | "waiting"; notes: string; date_of_birth: string }>({ name: "", email: "", phone: "", status: "confirmed", notes: "", date_of_birth: "" });
  const [editPart, setEditPart] = useState<Participant | null>(null);

  async function load() {
    const { data } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
    const list = (data as Course[]) || [];
    setRows(list);
    const { data: parts } = await supabase.from("course_participants").select("course_id,status");
    const map: Record<string, { confirmed: number; waiting: number }> = {};
    (parts || []).forEach((p: any) => {
      map[p.course_id] = map[p.course_id] || { confirmed: 0, waiting: 0 };
      if (p.status === "confirmed") map[p.course_id].confirmed++;
      else if (p.status === "waiting") map[p.course_id].waiting++;
    });
    setCounts(map);
  }
  useEffect(() => { load(); }, []);

  async function openParticipants(c: Course) {
    setPartCourse(c); setPartOpen(true);
    const { data } = await supabase.from("course_participants").select("*").eq("course_id", c.id).order("created_at", { ascending: true });
    setParticipants((data as Participant[]) || []);
  }
  async function addParticipant() {
    if (!partCourse) return;
    if (!newPart.name.trim()) return toast.error("Name erforderlich");
    const { error } = await supabase.from("course_participants").insert({
      course_id: partCourse.id,
      participant_name: newPart.name.trim(),
      participant_email: newPart.email.trim() || null,
      participant_phone: newPart.phone.trim() || null,
      status: newPart.status,
      notes: newPart.notes.trim() || null,
      date_of_birth: newPart.date_of_birth || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Teilnehmer hinzugefügt");
    setNewPart({ name: "", email: "", phone: "", status: "confirmed", notes: "", date_of_birth: "" });

    await openParticipants(partCourse);
    await load();
  }
  async function updatePartStatus(p: Participant, status: "confirmed" | "waiting" | "cancelled") {
    const { error } = await supabase.from("course_participants").update({ status }).eq("id", p.id);
    if (error) return toast.error(error.message);
    if (partCourse) await openParticipants(partCourse);
    await load();
  }
  async function removePart(p: Participant) {
    if (!confirm(`Teilnehmer "${p.participant_name}" entfernen?`)) return;
    const { error } = await supabase.from("course_participants").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Entfernt");
    if (partCourse) await openParticipants(partCourse);
    await load();
  }
  async function savePart() {
    if (!editPart) return;
    if (!editPart.participant_name?.trim()) return toast.error("Name erforderlich");
    const { error } = await supabase.from("course_participants").update({
      participant_name: editPart.participant_name.trim(),
      participant_email: editPart.participant_email?.trim() || null,
      participant_phone: editPart.participant_phone?.trim() || null,
      date_of_birth: editPart.date_of_birth || null,
      status: editPart.status,
      notes: editPart.notes?.trim() || null,
      goal_reached: editPart.goal_reached,
      achievement: editPart.achievement?.trim() || null,
      badge: editPart.badge?.trim() || null,
      paid: editPart.paid,
      paid_at: editPart.paid ? (editPart.paid_at || new Date().toISOString()) : null,
      paid_by: editPart.paid ? (await supabase.auth.getUser()).data.user?.id ?? null : null,
      payment_note: editPart.payment_note?.trim() || null,
    }).eq("id", editPart.id);
    if (error) return toast.error(error.message);
    toast.success("Gespeichert");
    setEditPart(null);
    if (partCourse) await openParticipants(partCourse);
    await load();
  }
  async function togglePaid(p: Participant, paid: boolean) {
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const { error } = await supabase.from("course_participants").update({
      paid,
      paid_at: paid ? new Date().toISOString() : null,
      paid_by: paid ? userId : null,
    }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(paid ? "Als bezahlt markiert" : "Zahlung zurückgesetzt");
    if (partCourse) await openParticipants(partCourse);
  }


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
              {rows.map(c => {
                const cnt = counts[c.id] || { confirmed: 0, waiting: 0 };
                const max = c.max_participants;
                const full = max != null && cnt.confirmed >= max;
                return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}{!c.is_public && <Badge variant="secondary" className="ml-2 text-xs">Intern</Badge>}</TableCell>
                  <TableCell className="text-xs">{c.target_group || c.age_range || "—"}</TableCell>
                  <TableCell className="text-xs">{c.starts_on || "—"} – {c.ends_on || "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{STATUS_LABEL[c.status] || c.status}</Badge></TableCell>
                  <TableCell className="text-xs">
                    <span className={full ? "text-destructive font-semibold" : "font-semibold"}>{cnt.confirmed}</span>
                    {max != null ? <> / {max}</> : null}
                    {cnt.waiting > 0 && <span className="ml-2 text-muted-foreground">(+{cnt.waiting} WL)</span>}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => openParticipants(c)}><Users className="h-4 w-4" /> Teilnehmer</Button>
                    <Button variant="ghost" size="sm" onClick={() => startEdit(c)}>Bearbeiten</Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              )})}

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

      <Dialog open={partOpen} onOpenChange={setPartOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Teilnehmer: {partCourse?.name}</DialogTitle>
          </DialogHeader>
          {partCourse && (() => {
            const cnt = counts[partCourse.id] || { confirmed: 0, waiting: 0 };
            const max = partCourse.max_participants;
            const free = max != null ? Math.max(0, max - cnt.confirmed) : null;
            return (
              <div className="text-sm text-muted-foreground mb-2">
                Bestätigt: <span className="font-semibold text-foreground">{cnt.confirmed}</span>
                {max != null && <> von {max} · Frei: <span className="font-semibold text-foreground">{free}</span></>}
                {cnt.waiting > 0 && <> · Warteliste: <span className="font-semibold text-foreground">{cnt.waiting}</span></>}
              </div>
            );
          })()}
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Geburtsdatum</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ergebnis</TableHead>
                  <TableHead>Bezahlt</TableHead>
                  <TableHead>Notiz</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground text-xs">Noch keine Teilnehmer.</TableCell></TableRow>}
                {participants.map(p => {
                  const age = ageAt(p.date_of_birth, partCourse?.starts_on);
                  return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">{p.participant_name || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {p.date_of_birth ? (
                        <>
                          {fmtDate(p.date_of_birth)}
                          {age != null && (
                            <div className="text-muted-foreground">{age} J. {partCourse?.starts_on ? "bei Kursbeginn" : "(heute)"}</div>
                          )}
                        </>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{p.participant_email || "—"}{p.participant_phone && <><br />{p.participant_phone}</>}</TableCell>
                    <TableCell>
                      <Select value={p.status} onValueChange={(v: any) => updatePartStatus(p, v)}>
                        <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{ENROLL_STATUS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.goal_reached === true && <Badge className="bg-green-600 hover:bg-green-700"><Award className="h-3 w-3 mr-1" />Ziel erreicht</Badge>}
                      {p.goal_reached === false && <Badge variant="secondary">Ziel offen</Badge>}
                      {p.badge && <div className="mt-1">{p.badge}</div>}
                      {p.achievement && <div className="text-muted-foreground mt-0.5 max-w-[180px] truncate" title={p.achievement}>{p.achievement}</div>}
                      {p.goal_reached == null && !p.badge && !p.achievement && "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={p.paid} onCheckedChange={v => togglePaid(p, !!v)} />
                        {p.paid ? (
                          <span className="text-green-700 font-medium">Bezahlt{p.paid_at && <div className="text-muted-foreground font-normal">{fmtDate(p.paid_at)}</div>}</span>
                        ) : (
                          <span className="text-muted-foreground">offen</span>
                        )}
                      </label>
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{p.notes || "—"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => setEditPart(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => removePart(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          </div>

          <div className="border-t pt-4 mt-4 space-y-3">
            <div className="font-semibold text-sm">Teilnehmer hinzufügen</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name *</Label><Input value={newPart.name} onChange={e => setNewPart(p => ({ ...p, name: e.target.value }))} /></div>
              <div>
                <Label>Geburtsdatum</Label>
                <Input type="date" value={newPart.date_of_birth} onChange={e => setNewPart(p => ({ ...p, date_of_birth: e.target.value }))} />
                {newPart.date_of_birth && (() => {
                  const a = ageAt(newPart.date_of_birth, partCourse?.starts_on);
                  return a != null ? <div className="text-xs text-muted-foreground mt-1">{a} Jahre {partCourse?.starts_on ? "bei Kursbeginn" : "(heute)"}</div> : null;
                })()}
              </div>
              <div><Label>E-Mail</Label><Input type="email" value={newPart.email} onChange={e => setNewPart(p => ({ ...p, email: e.target.value }))} /></div>
              <div><Label>Telefon</Label><Input value={newPart.phone} onChange={e => setNewPart(p => ({ ...p, phone: e.target.value }))} /></div>
              <div>
                <Label>Status</Label>
                <Select value={newPart.status} onValueChange={(v: any) => setNewPart(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Bestätigt</SelectItem>
                    <SelectItem value="waiting">Warteliste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div><Label>Notiz</Label><Textarea rows={2} value={newPart.notes} onChange={e => setNewPart(p => ({ ...p, notes: e.target.value }))} /></div>
            <Button onClick={addParticipant}><Plus className="h-4 w-4" /> Hinzufügen</Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPartOpen(false)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editPart} onOpenChange={v => !v && setEditPart(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Teilnehmer bearbeiten</DialogTitle></DialogHeader>
          {editPart && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name *</Label><Input value={editPart.participant_name || ""} onChange={e => setEditPart(p => p && { ...p, participant_name: e.target.value })} /></div>
                <div>
                  <Label>Geburtsdatum</Label>
                  <Input type="date" value={editPart.date_of_birth || ""} onChange={e => setEditPart(p => p && { ...p, date_of_birth: e.target.value })} />
                  {editPart.date_of_birth && (() => {
                    const a = ageAt(editPart.date_of_birth, partCourse?.starts_on);
                    return a != null ? <div className="text-xs text-muted-foreground mt-1">{a} Jahre {partCourse?.starts_on ? "bei Kursbeginn" : "(heute)"}</div> : null;
                  })()}
                </div>
                <div><Label>E-Mail</Label><Input type="email" value={editPart.participant_email || ""} onChange={e => setEditPart(p => p && { ...p, participant_email: e.target.value })} /></div>
                <div><Label>Telefon</Label><Input value={editPart.participant_phone || ""} onChange={e => setEditPart(p => p && { ...p, participant_phone: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={editPart.status} onValueChange={(v: any) => setEditPart(p => p && { ...p, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ENROLL_STATUS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Notiz</Label><Textarea rows={2} value={editPart.notes || ""} onChange={e => setEditPart(p => p && { ...p, notes: e.target.value })} /></div>

              <div className="border-t pt-3 mt-2">
                <div className="font-semibold text-sm mb-2 flex items-center gap-2"><Award className="h-4 w-4" /> Kursergebnis</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Kursziel erreicht?</Label>
                    <Select
                      value={editPart.goal_reached == null ? "unset" : editPart.goal_reached ? "yes" : "no"}
                      onValueChange={(v) => setEditPart(p => p && { ...p, goal_reached: v === "unset" ? null : v === "yes" })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unset">— Offen —</SelectItem>
                        <SelectItem value="yes">Ja, erreicht</SelectItem>
                        <SelectItem value="no">Nein, nicht erreicht</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Abzeichen</Label><Input placeholder="z.B. Seepferdchen, Bronze" value={editPart.badge || ""} onChange={e => setEditPart(p => p && { ...p, badge: e.target.value })} /></div>
                </div>
                <div className="mt-3"><Label>Geschafft / Anmerkungen zum Ergebnis</Label><Textarea rows={3} placeholder="z.B. 25m geschwommen, Sprung vom Beckenrand …" value={editPart.achievement || ""} onChange={e => setEditPart(p => p && { ...p, achievement: e.target.value })} /></div>
              </div>

              <div className="border-t pt-3 mt-2">
                <div className="font-semibold text-sm mb-2 flex items-center gap-2"><Euro className="h-4 w-4" /> Zahlung (Buchhaltung)</div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={editPart.paid} onCheckedChange={v => setEditPart(p => p && { ...p, paid: !!v, paid_at: v ? (p.paid_at || new Date().toISOString()) : null })} />
                  Kursgebühr bezahlt
                </label>
                {editPart.paid && editPart.paid_at && (
                  <div className="text-xs text-muted-foreground mt-1">Bestätigt am {fmtDate(editPart.paid_at)}</div>
                )}
                <div className="mt-3"><Label>Zahlungsnotiz</Label><Textarea rows={2} placeholder="z.B. Überweisung, Bar, Rechnungsnr. …" value={editPart.payment_note || ""} onChange={e => setEditPart(p => p && { ...p, payment_note: e.target.value })} /></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPart(null)}>Abbrechen</Button>
            <Button onClick={savePart}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

