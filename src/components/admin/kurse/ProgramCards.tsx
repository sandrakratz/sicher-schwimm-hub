import { Euro, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Course, CourseCounts, ProgramRow } from "@/components/admin/kurse/shared";

/** Belegung über alle laufenden (nicht archivierten) Zeiträume eines Angebots. */
function programStats(terms: Course[], counts: Record<string, CourseCounts>) {
  let confirmed = 0;
  let reserved = 0;
  let capacity = 0;
  let free = 0;
  let bookable = 0;
  for (const t of terms) {
    const taken = (counts[t.id]?.confirmed ?? 0) + (counts[t.id]?.offered ?? 0);
    confirmed += counts[t.id]?.confirmed ?? 0;
    reserved += counts[t.id]?.offered ?? 0;
    capacity += t.max_participants ?? 0;
    if (t.max_participants != null) free += Math.max(0, t.max_participants - taken);
    if (t.max_participants == null || taken < t.max_participants) bookable++;
  }
  const hasCap = terms.length > 0 && terms.every((t) => t.max_participants != null);
  return { confirmed, reserved, capacity, free, bookable, hasCap };
}

const CARD = "border-0 shadow-soft cursor-pointer transition hover:shadow-lg";

function ProgramCard({
  p,
  terms,
  counts,
  waiting,
  onOpen,
  onNewTerm,
}: {
  p: ProgramRow;
  terms: Course[];
  counts: Record<string, CourseCounts>;
  waiting: number;
  onOpen: () => void;
  onNewTerm: () => void;
}) {
  const s = programStats(terms, counts);
  return (
    <Card className={CARD} onClick={onOpen}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-display text-lg font-semibold text-primary-deep">{p.name}</div>
            <div className="text-xs text-muted-foreground">{p.location || "Ort offen"}</div>
          </div>
          {!p.is_public && (
            <Badge variant="secondary" className="text-xs">
              Intern
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          <div>
            {p.age_range || "Alter offen"}
            {p.min_age_years != null ? ` (min. ${p.min_age_years} J.)` : ""}
          </div>
          <div>
            <Euro className="inline h-3 w-3 mr-1" />
            {p.price_non_member ?? "—"} € / {p.price_member ?? "—"} € (Mitgl.)
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{terms.length} Zeiträume</Badge>
          <Badge variant="outline">{s.bookable} buchbar</Badge>
          <Badge variant="outline">
            {s.confirmed}
            {s.capacity > 0 ? ` / ${s.capacity}` : ""} belegt
          </Badge>
          {s.reserved > 0 && (
            <Badge
              variant="secondary"
              title="Plätze, die gerade einem Kind von der Warteliste angeboten sind"
            >
              {s.reserved} reserviert
            </Badge>
          )}
          {waiting > 0 && (
            <Badge
              variant="secondary"
              title="Familien auf der Anfrageliste, die auf einen Platz in diesem Angebot warten"
            >
              {waiting} wartend
            </Badge>
          )}
          {s.hasCap &&
            (s.free > 0 ? (
              <Badge
                className="bg-success text-success-foreground hover:bg-success"
                title="Tatsächlich frei für neue Anmeldungen"
              >
                {s.free} frei
              </Badge>
            ) : (
              <Badge variant="destructive">Ausgebucht</Badge>
            ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            Öffnen
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onNewTerm();
            }}
          >
            <Plus className="h-4 w-4" /> Neuer Zeitraum
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Übersicht aller Kursangebote als Karten, plus Karte „Ohne Kursangebot“. */
export function ProgramCards({
  programs,
  counts,
  termsOf,
  waitingFor,
  onOpen,
  onNewTerm,
}: {
  programs: ProgramRow[];
  counts: Record<string, CourseCounts>;
  termsOf: (programId: string | null) => Course[];
  waitingFor: (programId: string | null) => number;
  onOpen: (p: ProgramRow | null) => void;
  onNewTerm: (p: ProgramRow) => void;
}) {
  const unassigned = termsOf(null);
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {programs.length === 0 && unassigned.length === 0 && (
        <Card className="border-0 shadow-soft md:col-span-2 xl:col-span-3">
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            Noch keine Kurse angelegt.
          </CardContent>
        </Card>
      )}

      {programs.map((p) => (
        <ProgramCard
          key={p.id}
          p={p}
          terms={termsOf(p.id).filter((t) => !t.archived_at)}
          counts={counts}
          waiting={waitingFor(p.id)}
          onOpen={() => onOpen(p)}
          onNewTerm={() => onNewTerm(p)}
        />
      ))}

      {unassigned.length > 0 && (
        <Card className={CARD} onClick={() => onOpen(null)}>
          <CardContent className="p-5 space-y-3">
            <div className="font-display text-lg font-semibold text-primary-deep">
              Ohne Kursangebot
            </div>
            <p className="text-xs text-muted-foreground">
              Zeiträume, die keinem Kurs zugeordnet sind und daher nicht auf der Webseite
              erscheinen.
            </p>
            <Badge variant="outline" className="text-xs">
              {unassigned.length} Zeiträume
            </Badge>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
