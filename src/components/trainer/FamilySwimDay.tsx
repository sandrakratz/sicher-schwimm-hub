import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { todayBerlinIso } from "@/lib/format";
import { weekdayDate } from "@/lib/familienschwimmen";
import {
  setFamilySwimAttendance,
  type TrainerFamilySwimEvent,
} from "@/lib/familienschwimmen.functions";

type Group = TrainerFamilySwimEvent["groups"][number];

/** Wird nach dem Speichern der Anwesenheit aufgerufen, damit die Liste ohne Neuladen stimmt. */
export type AttendanceSaved = (requestId: string, presentKeys: string[]) => void;

const peopleCount = (e: TrainerFamilySwimEvent) =>
  e.groups.reduce((n, g) => n + g.persons.length, 0);

const slotText = (e: TrainerFamilySwimEvent) =>
  `${weekdayDate(e.event_date)} · ${e.start_time}–${e.end_time} Uhr · ${e.location}`;

/** Eine Anmeldung: Personen, bei Bedarf mit Häkchen „war da“ (nur am Termintag und danach). */
function GroupRow({
  group,
  canMark,
  onSaved,
}: {
  group: Group;
  canMark: boolean;
  onSaved: AttendanceSaved;
}) {
  const save = useServerFn(setFamilySwimAttendance);
  const saved = group.persons.filter((p) => p.present).map((p) => p.key);
  const [sel, setSel] = useState<string[]>(saved);
  const [busy, setBusy] = useState(false);
  const recorded = group.status !== "confirmed";
  const dirty = !recorded || sel.length !== saved.length || sel.some((k) => !saved.includes(k));

  const toggle = (key: string) =>
    setSel((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  async function submit() {
    setBusy(true);
    try {
      await save({ data: { requestId: group.id, presentKeys: sel } });
      onSaved(group.id, sel);
      toast.success(sel.length ? "Anwesenheit gespeichert" : "Als nicht erschienen gespeichert");
    } catch (e) {
      toast.error((e as Error)?.message || "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border p-3 text-sm">
      <ul className="space-y-1">
        {group.persons.map((p) => (
          <li key={p.key}>
            <label className={`flex min-h-9 items-center gap-2 ${canMark ? "cursor-pointer" : ""}`}>
              {canMark && (
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={sel.includes(p.key)}
                  onChange={() => toggle(p.key)}
                />
              )}
              <span>
                {p.name || "—"}{" "}
                <span className="text-muted-foreground">
                  {p.role === "child" ? "Kind" : "Erwachsen"}
                  {p.age != null ? `, ${p.age} J.` : ""}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {group.grandstand_name && (
        <p className="mt-2 text-xs text-muted-foreground">
          Aufsichtsperson auf der Tribüne: {group.grandstand_name}
        </p>
      )}
      {canMark && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSel(group.persons.map((p) => p.key))}
          >
            Alle da
          </Button>
          <Button size="sm" onClick={submit} disabled={busy || !dirty}>
            {busy ? "Speichert…" : "Anwesenheit speichern"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {!recorded
              ? "Noch nicht erfasst"
              : group.status === "no_show"
                ? "Erfasst: niemand erschienen"
                : `Erfasst: ${saved.length} von ${group.persons.length} da`}
          </span>
        </div>
      )}
    </div>
  );
}

function Groups({ event, onSaved }: { event: TrainerFamilySwimEvent; onSaved: AttendanceSaved }) {
  const canMark = event.event_date <= todayBerlinIso();
  return (
    <div className="space-y-3">
      {event.notes && <p className="text-sm text-muted-foreground">{event.notes}</p>}
      {event.groups.length === 0 && (
        <p className="text-sm text-muted-foreground">Noch keine Zusagen für diesen Termin.</p>
      )}
      {event.groups.map((g) => (
        <GroupRow key={g.id} group={g} canMark={canMark} onSaved={onSaved} />
      ))}
    </div>
  );
}

/** Mitgliederschwimmen als „Kurs“ im Trainerbereich: wer an diesem Termin den Zuschlag hat und da war. */
export function FamilySwimDay({
  event,
  open,
  onSaved,
}: {
  event: TrainerFamilySwimEvent;
  open: boolean;
  onSaved: AttendanceSaved;
}) {
  return (
    <CollapsibleCard
      defaultOpen={open}
      storageKey={`trainer-mitgliederschwimmen-${event.id}`}
      title="Mitgliederschwimmen"
      subtitle={slotText(event)}
      meta={<Badge variant="secondary">{peopleCount(event)} Personen</Badge>}
    >
      <div className="px-4 pb-4 sm:px-6">
        <Groups event={event} onSaved={onSaved} />
      </div>
    </CollapsibleCard>
  );
}

/** Spätere Termine in einer einzigen, eingeklappten Karte; ein Tipp auf eine Zeile zeigt die Namen. */
export function FamilySwimUpcoming({
  events,
  onSaved,
}: {
  events: TrainerFamilySwimEvent[];
  onSaved: AttendanceSaved;
}) {
  return (
    <CollapsibleCard
      storageKey="trainer-mitgliederschwimmen-spaeter"
      title="Weitere Termine Mitgliederschwimmen"
      subtitle="Kommende Termine mit Zusagen – kurz vorher erscheinen sie oben als eigener Knopf"
      meta={<Badge variant="outline">{events.length}</Badge>}
      defaultOpen={false}
    >
      <div className="space-y-2 px-4 pb-4 sm:px-6">
        {events.map((e) => (
          <details key={e.id} className="rounded-md border px-3 py-2">
            <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm">
              <span>{slotText(e)}</span>
              <Badge variant="secondary">{peopleCount(e)} Personen</Badge>
            </summary>
            <div className="mt-2">
              <Groups event={e} onSaved={onSaved} />
            </div>
          </details>
        ))}
      </div>
    </CollapsibleCard>
  );
}
