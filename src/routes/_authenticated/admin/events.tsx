import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Users, AlertTriangle, Check, X } from "lucide-react";
import { formatDateTimeBerlin } from "@/lib/format";
import { useServerFn } from "@tanstack/react-start";
import { listTrainers, type TrainerOption } from "@/lib/trainers.functions";
import {
  berlinTime, coverageGaps, coverageSlices, formatRange, signupInterval,
  toBerlinInput, fromBerlinInput, type ShiftSignup,
} from "@/lib/event-shifts";

export const Route = createFileRoute("/_authenticated/admin/events")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/admin-guard.functions");
    const { redirect } = await import("@tanstack/react-router");
    try { await assertHasAnyRole({ data: { roles: ["admin", "board"] } }); }
    catch { throw redirect({ to: "/admin/benutzer" }); }
  },
  head: () => ({
    meta: [
      { title: "Eventverwaltung – Adminbereich | Sicher Schwimmen e.V." },
      { name: "description", content: "Termine und Veranstaltungen verwalten und Helfer-Umfragen unter Trainer:innen starten." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
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
  signup_enabled: boolean;
  signup_note: string | null;
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
  const [signups, setSignups] = useState<ShiftSignup[]>([]);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [helperEvent, setHelperEvent] = useState<Ev | null>(null);
  const trainersFn = useServerFn(listTrainers);

  async function load() {
    const { data } = await supabase.from("events").select("*").order("starts_at", { ascending: false });
    setRows((data as Ev[]) || []);
    const { data: su } = await supabase
      .from("event_shift_signups")
      .select("id,event_id,trainer_id,available,starts_at,ends_at,note")
      .order("starts_at", { ascending: true });
    setSignups((su as ShiftSignup[]) || []);
  }
  useEffect(() => {
    load();
    trainersFn().then(setTrainers).catch(() => { /* Namen optional */ });
  }, []);

  function startNew() { setEditing({ visibility: "public", starts_at: new Date().toISOString(), signup_enabled: false }); setOpen(true); }
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
      signup_enabled: !!editing.signup_enabled,
      signup_note: editing.signup_note || null,
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

  const helperCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of signups) if (s.available) m[s.event_id] = (m[s.event_id] || 0) + 1;
    return m;
  }, [signups]);

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary-deep">Eventverwaltung</h1>
          <p className="text-muted-foreground mt-1 text-sm">Termine, Wettkämpfe und Veranstaltungen – inklusive Helfer-Umfrage für Trainer:innen.</p>
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
                <TableHead>Helfer</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Noch keine Events.</TableCell></TableRow>}
              {rows.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.title}</TableCell>
                  <TableCell className="text-sm">{formatDateTimeBerlin(e.starts_at)}</TableCell>
                  <TableCell className="text-sm">{e.location || "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{VISIBILITY_LABEL[e.visibility] || e.visibility}</Badge></TableCell>
                  <TableCell className="text-sm">
                    {e.signup_enabled ? (
                      <Button variant="outline" size="sm" onClick={() => setHelperEvent(e)}>
                        <Users className="h-4 w-4" /> Helfer ({helperCounts[e.id] || 0})
                      </Button>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
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
              <div><Label>Start *</Label><Input type="datetime-local" value={toLocal(editing.starts_at)} onChange={e => setEditing(p => ({ ...p, starts_at: fromLocal(e.target.value) || p.starts_at }))} /></div>
              <div><Label>Ende</Label><Input type="datetime-local" value={toLocal(editing.ends_at)} onChange={e => setEditing(p => ({ ...p, ends_at: fromLocal(e.target.value) }))} /></div>
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
            <div className="rounded-md border p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={!!editing.signup_enabled}
                  onCheckedChange={v => setEditing(p => ({ ...p, signup_enabled: !!v }))}
                />
                Helfer-Umfrage aktivieren
              </label>
              <p className="text-xs text-muted-foreground">
                Trainer:innen können unter „Verfügbarkeit“ zusagen und ihr Zeitfenster (von–bis) angeben.
              </p>
              <div>
                <Label>Hinweis für Trainer:innen</Label>
                <Textarea
                  rows={2}
                  placeholder="z. B. Bitte Zeitfenster eintragen, Schichten mind. 2 Stunden."
                  value={editing.signup_note || ""}
                  onChange={e => setEditing(p => ({ ...p, signup_note: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HelperDialog
        event={helperEvent}
        signups={signups.filter(s => helperEvent && s.event_id === helperEvent.id)}
        trainers={trainers}
        onClose={() => setHelperEvent(null)}
        onChanged={load}
      />
    </div>
  );
}

function HelperDialog({
  event, signups, trainers, onClose, onChanged,
}: {
  event: Ev | null;
  signups: ShiftSignup[];
  trainers: TrainerOption[];
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const trainerName = (id: string) => trainers.find(t => t.id === id)?.name || "Unbekannt";
  const eventStart = event ? Date.parse(event.starts_at) : 0;
  const eventEnd = event
    ? (event.ends_at ? Date.parse(event.ends_at) : eventStart + 2 * 3600_000)
    : 0;

  const intervals = useMemo(
    () => (event ? signups.map(s => signupInterval(s, eventStart, eventEnd)).filter(Boolean) as { start: number; end: number }[] : []),
    [signups, eventStart, eventEnd, event],
  );
  const gaps = useMemo(() => coverageGaps(intervals, eventStart, eventEnd), [intervals, eventStart, eventEnd]);
  const slices = useMemo(() => coverageSlices(intervals, eventStart, eventEnd), [intervals, eventStart, eventEnd]);
  const maxCount = Math.max(1, ...slices.map(s => s.count));
  const noReply = trainers.filter(t => !signups.some(s => s.trainer_id === t.id));

  async function removeSignup(id: string) {
    const { error } = await supabase.from("event_shift_signups").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Rückmeldung gelöscht");
    await onChanged();
  }

  async function updateTime(s: ShiftSignup, field: "starts_at" | "ends_at", value: string) {
    const iso = fromBerlinInput(value);
    const payload: { starts_at?: string | null; ends_at?: string | null } =
      field === "starts_at" ? { starts_at: iso } : { ends_at: iso };
    const { error } = await supabase
      .from("event_shift_signups")
      .update(payload)
      .eq("id", s.id);
    if (error) return toast.error(error.message);
    await onChanged();
  }

  return (
    <Dialog open={!!event} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Helfer: {event?.title}</DialogTitle></DialogHeader>
        {event && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              {formatDateTimeBerlin(event.starts_at)}
              {event.ends_at ? ` – ${berlinTime(event.ends_at)} Uhr` : ""}
              {event.location ? ` · ${event.location}` : ""}
            </p>

            <div>
              <div className="mb-2 text-sm font-medium">Besetzung im Zeitverlauf</div>
              <div className="flex gap-[2px]">
                {slices.map(s => (
                  <div key={s.start} className="flex-1" title={`${formatRange(s.start, s.end)}: ${s.count} Helfer`}>
                    <div
                      className={`h-10 rounded-sm ${s.count === 0 ? "bg-destructive/25" : "bg-primary"}`}
                      style={{ opacity: s.count === 0 ? 1 : 0.35 + 0.65 * (s.count / maxCount) }}
                    />
                    <div className="mt-1 text-center text-[9px] text-muted-foreground">{berlinTime(new Date(s.start).toISOString())}</div>
                  </div>
                ))}
                {slices.length === 0 && <p className="text-sm text-muted-foreground">Kein Zeitraum hinterlegt.</p>}
              </div>
              {gaps.length > 0 ? (
                <p className="mt-3 inline-flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Nicht besetzt: {gaps.map(g => formatRange(g.start, g.end)).join(", ")}
                </p>
              ) : (
                <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-green-600/10 px-3 py-2 text-sm text-green-700">
                  <Check className="h-4 w-4" /> Durchgängig besetzt.
                </p>
              )}
            </div>

            <div>
              <div className="mb-2 text-sm font-medium">Rückmeldungen ({signups.length})</div>
              <div className="divide-y rounded-md border">
                {signups.length === 0 && <p className="p-3 text-sm text-muted-foreground">Noch keine Rückmeldungen.</p>}
                {signups.map(s => (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-[10rem] flex-1">
                      <div className="text-sm font-medium">{trainerName(s.trainer_id)}</div>
                      {s.note && <div className="text-xs text-muted-foreground">{s.note}</div>}
                    </div>
                    {s.available ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="datetime-local"
                          className="h-8 w-[13rem]"
                          value={toBerlinInput(s.starts_at) || toBerlinInput(event.starts_at)}
                          onChange={e => updateTime(s, "starts_at", e.target.value)}
                        />
                        <span className="text-xs text-muted-foreground">bis</span>
                        <Input
                          type="datetime-local"
                          className="h-8 w-[13rem]"
                          value={toBerlinInput(s.ends_at) || toBerlinInput(event.ends_at)}
                          onChange={e => updateTime(s, "ends_at", e.target.value)}
                        />
                      </div>
                    ) : (
                      <Badge variant="secondary" className="gap-1"><X className="h-3 w-3" /> Kann nicht</Badge>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => removeSignup(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {noReply.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Ohne Rückmeldung: {noReply.map(t => t.name).join(", ")}
              </p>
            )}
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Schließen</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
