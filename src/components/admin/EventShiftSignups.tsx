import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, MapPin, CalendarPlus, Plus, Trash2, AlertTriangle } from "lucide-react";
import { formatDateTimeBerlin } from "@/lib/format";
import { buildIcs, type CalendarItem } from "@/lib/ics";
import {
  berlinParts, berlinTime, coverageGaps, formatRange, signupInterval,
  toBerlinInput, fromBerlinInput, type ShiftSignup,
} from "@/lib/event-shifts";
import type { TrainerOption } from "@/lib/trainers.functions";
import { useServerFn } from "@tanstack/react-start";
import { listHelperGroups, syncHelperGroupFill } from "@/lib/event-helpers.functions";

type HelperGroup = {
  id: string;
  event_id: string;
  name: string;
  needed_count: number;
  starts_at: string | null;
  ends_at: string | null;
  filled_at: string | null;
};

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  signup_note: string | null;
};

export function EventShiftSignups({ me, trainers }: { me: string; trainers: TrainerOption[] }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [signups, setSignups] = useState<ShiftSignup[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [groups, setGroups] = useState<HelperGroup[]>([]);
  const listGroupsFn = useServerFn(listHelperGroups);
  const syncFn = useServerFn(syncHelperGroupFill);

  async function load() {
    const nowIso = new Date().toISOString();
    const { data: evs } = await supabase
      .from("events")
      .select("id,title,description,location,starts_at,ends_at,signup_note")
      .eq("signup_enabled", true)
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true });
    const rows = (evs as EventRow[]) || [];
    setEvents(rows);
    if (rows.length === 0) { setSignups([]); return; }
    const { data: su } = await supabase
      .from("event_shift_signups")
      .select("id,event_id,trainer_id,available,starts_at,ends_at,note,group_id,helper_name")
      .in("event_id", rows.map(r => r.id));
    setSignups((su as ShiftSignup[]) || []);
    try {
      const res = (await listGroupsFn({ data: { eventIds: rows.map(r => r.id) } })) as { groups: HelperGroup[] };
      setGroups(res.groups || []);
    } catch { /* Helferstellen optional */ }
  }

  async function assignGroup(signupId: string, eventId: string, groupId: string | null) {
    const { error } = await supabase.from("event_shift_signups").update({ group_id: groupId }).eq("id", signupId);
    if (error) return toast.error(error.message);
    try { await syncFn({ data: { eventId } }); } catch { /* Besetzung wird beim nächsten Laden aktualisiert */ }
    await load();
  }

  useEffect(() => { load(); }, []);

  const trainerName = (id: string) => trainers.find(t => t.id === id)?.name || "Unbekannt";

  const eventEndOf = (e: EventRow) =>
    e.ends_at ? Date.parse(e.ends_at) : Date.parse(e.starts_at) + 2 * 3600_000;

  async function setDecision(e: EventRow, available: boolean) {
    if (!me) return;
    setBusy(e.id);
    const mine = signups.filter(s => s.event_id === e.id && s.trainer_id === me);
    if (mine.length > 0) {
      const { error } = await supabase
        .from("event_shift_signups")
        .update({ available })
        .eq("event_id", e.id)
        .eq("trainer_id", me);
      setBusy(null);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("event_shift_signups").insert({
        event_id: e.id,
        trainer_id: me,
        available,
        starts_at: available ? e.starts_at : null,
        ends_at: available ? new Date(eventEndOf(e)).toISOString() : null,
      });
      setBusy(null);
      if (error) return toast.error(error.message);
    }
    toast.success(available ? "Zusage gespeichert" : "Absage gespeichert");
    await load();
  }

  async function addWindow(e: EventRow) {
    setBusy(e.id);
    const { error } = await supabase.from("event_shift_signups").insert({
      event_id: e.id,
      trainer_id: me,
      available: true,
      starts_at: e.starts_at,
      ends_at: new Date(eventEndOf(e)).toISOString(),
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    await load();
  }

  async function patch(
    id: string,
    patchData: { starts_at?: string | null; ends_at?: string | null; note?: string | null },
  ) {
    const { error } = await supabase.from("event_shift_signups").update(patchData).eq("id", id);
    if (error) return toast.error(error.message);
    await load();
  }

  async function removeRow(id: string) {
    const { error } = await supabase.from("event_shift_signups").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await load();
  }

  function exportIcs() {
    const items: CalendarItem[] = [];
    for (const e of events) {
      for (const s of signups.filter(x => x.trainer_id === me && x.event_id === e.id && x.available)) {
        const start = berlinParts(s.starts_at || e.starts_at);
        const end = berlinParts(s.ends_at || new Date(eventEndOf(e)).toISOString());
        if (!start || !end) continue;
        items.push({
          id: s.id,
          date: start.date,
          start: start.time,
          end: end.time,
          title: e.title,
          location: e.location || "",
          description: s.note || e.description || "",
        });
      }
    }
    if (items.length === 0) return toast.error("Keine zugesagten Einsätze vorhanden.");
    const blob = new Blob([buildIcs(items)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sicher-schwimmen-einsaetze.ics";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(`${items.length} Einsätze exportiert`);
  }

  const content = useMemo(() => events, [events]);
  if (content.length === 0) return null;

  return (
    <div className="mb-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl font-bold text-primary-deep">Termine &amp; Helfer-Einsätze</h2>
        <Button size="sm" variant="outline" onClick={exportIcs}>
          <CalendarPlus className="h-4 w-4" /> Meine Einsätze (.ics)
        </Button>
      </div>

      {events.map(e => {
        const eventStart = Date.parse(e.starts_at);
        const eventEnd = eventEndOf(e);
        const all = signups.filter(s => s.event_id === e.id);
        const mine = all.filter(s => s.trainer_id === me);
        const decided = mine.length > 0 ? mine.every(s => s.available) : null;
        const declined = mine.length > 0 && mine.every(s => !s.available);
        const intervals = all.map(s => signupInterval(s, eventStart, eventEnd)).filter(Boolean) as { start: number; end: number }[];
        const gaps = coverageGaps(intervals, eventStart, eventEnd);
        const others = all.filter(s => s.trainer_id !== me && s.available);

        return (
          <CollapsibleCard
            key={e.id}
            className="border-0 shadow-soft"
            storageKey={`event-shift-${e.id}`}
            title={e.title}
            subtitle={
              <span className="flex flex-wrap gap-3">
                <span>{formatDateTimeBerlin(e.starts_at)}{e.ends_at ? ` – ${berlinTime(e.ends_at)} Uhr` : ""}</span>
                {e.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span>}
              </span>
            }
            contentClassName="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  {e.signup_note && <p className="mt-1 text-xs text-muted-foreground">{e.signup_note}</p>}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm" variant="outline" disabled={busy === e.id}
                    onClick={() => setDecision(e, true)}
                    className={decided === true ? "border-transparent bg-green-600 text-white hover:bg-green-700" : ""}
                  >
                    <Check className="h-4 w-4" /> Ich helfe
                  </Button>
                  <Button
                    size="sm" variant="outline" disabled={busy === e.id}
                    onClick={() => setDecision(e, false)}
                    className={declined ? "border-transparent bg-red-600 text-white hover:bg-red-700" : ""}
                  >
                    <X className="h-4 w-4" /> Ich kann nicht
                  </Button>
                </div>
              </div>

              {mine.some(s => s.available) && (
                <div className="space-y-2 rounded-md border p-3">
                  <div className="text-sm font-medium">Meine Zeitfenster</div>
                  {mine.filter(s => s.available).map(s => (
                    <div key={s.id} className="flex flex-wrap items-center gap-2">
                      <Input
                        type="datetime-local" className="h-8 w-[13rem]"
                        value={toBerlinInput(s.starts_at) || toBerlinInput(e.starts_at)}
                        onChange={ev => patch(s.id, { starts_at: fromBerlinInput(ev.target.value) })}
                      />
                      <span className="text-xs text-muted-foreground">bis</span>
                      <Input
                        type="datetime-local" className="h-8 w-[13rem]"
                        value={toBerlinInput(s.ends_at) || toBerlinInput(new Date(eventEnd).toISOString())}
                        onChange={ev => patch(s.id, { ends_at: fromBerlinInput(ev.target.value) })}
                      />
                      <Input
                        className="h-8 flex-1 min-w-[10rem]" placeholder="Notiz (optional)"
                        defaultValue={s.note || ""}
                        onBlur={ev => { if ((ev.target.value || "") !== (s.note || "")) patch(s.id, { note: ev.target.value || null }); }}
                      />
                      {groups.filter(g => g.event_id === e.id).length > 0 && (
                        <select
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={s.group_id || ""}
                          onChange={ev => assignGroup(s.id, e.id, ev.target.value || null)}
                        >
                          <option value="">Aufgabe wählen…</option>
                          {groups.filter(g => g.event_id === e.id).map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => removeRow(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" disabled={busy === e.id} onClick={() => addWindow(e)}>
                    <Plus className="h-4 w-4" /> Weiteres Zeitfenster
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {others.length > 0
                  ? others.map(s => (
                      <Badge key={s.id} variant="secondary">
                        {trainerName(s.trainer_id)}
                        {s.starts_at && s.ends_at ? ` ${berlinTime(s.starts_at)}–${berlinTime(s.ends_at)}` : ""}
                      </Badge>
                    ))
                  : <span>Noch keine weiteren Zusagen.</span>}
              </div>

              {groups.filter(g => g.event_id === e.id).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {groups.filter(g => g.event_id === e.id).map(g => {
                    const count = all.filter(s => s.group_id === g.id && s.available).length;
                    const full = count >= g.needed_count;
                    return (
                      <Badge
                        key={g.id}
                        variant="secondary"
                        className={full ? "border-transparent bg-green-600 text-white" : "bg-amber-100 text-amber-900"}
                      >
                        {g.name}: {count}/{g.needed_count}{full ? " besetzt" : ""}
                      </Badge>
                    );
                  })}
                </div>
              )}

              {gaps.length > 0 && (
                <p className="inline-flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Noch nicht besetzt: {gaps.map(g => formatRange(g.start, g.end)).join(", ")}
                </p>
              )}
          </CollapsibleCard>
        );
      })}
    </div>
  );
}
