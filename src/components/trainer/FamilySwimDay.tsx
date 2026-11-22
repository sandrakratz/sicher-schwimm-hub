import { Badge } from "@/components/ui/badge";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { weekdayDate } from "@/lib/familienschwimmen";
import type { TrainerFamilySwimEvent } from "@/lib/familienschwimmen.functions";

/** Mitgliederschwimmen als „Kurs“ im Trainerbereich: wer an diesem Termin den Zuschlag hat. */
export function FamilySwimDay({ event, open }: { event: TrainerFamilySwimEvent; open: boolean }) {
  const people = event.groups.reduce((n, g) => n + g.persons.length, 0);
  return (
    <CollapsibleCard
      defaultOpen={open}
      storageKey={`trainer-mitgliederschwimmen-${event.id}`}
      title="Mitgliederschwimmen"
      subtitle={`${weekdayDate(event.event_date)} · ${event.start_time}–${event.end_time} Uhr · ${event.location}`}
      meta={<Badge variant="secondary">{people} Personen</Badge>}
    >
      <div className="space-y-3 px-4 pb-4 sm:px-6">
        {event.notes && <p className="text-sm text-muted-foreground">{event.notes}</p>}
        {event.groups.length === 0 && (
          <p className="text-sm text-muted-foreground">Noch keine Zusagen für diesen Termin.</p>
        )}
        {event.groups.map((g) => (
          <div key={g.id} className="rounded-md border p-3 text-sm">
            <ul className="space-y-0.5">
              {g.persons.map((p, i) => (
                <li key={i}>
                  {p.name || "—"}{" "}
                  <span className="text-muted-foreground">
                    {p.role === "child" ? "Kind" : "Erwachsen"}
                    {p.age != null ? `, ${p.age} J.` : ""}
                  </span>
                </li>
              ))}
            </ul>
            {g.grandstand_name && (
              <p className="mt-2 text-xs text-muted-foreground">
                Aufsichtsperson auf der Tribüne: {g.grandstand_name}
              </p>
            )}
          </div>
        ))}
      </div>
    </CollapsibleCard>
  );
}
