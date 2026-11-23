import { Badge } from "@/components/ui/badge";
import { inView, type WaitlistEntry, type WaitlistProgram } from "./logic";

/** Kachel je Angebot (Programm) über den Reitern; Klick filtert auf dieses Angebot. */
export function ProgramTiles({
  programs,
  entries,
  freeForProgram,
  filter,
  onFilter,
}: {
  programs: WaitlistProgram[];
  entries: WaitlistEntry[];
  freeForProgram: (programId: string) => number;
  filter: string[] | null;
  onFilter: (f: string[] | null) => void;
}) {
  const tiles = [
    ...programs.map((p) => ({ key: p.id, name: p.name })),
    ...(entries.some((e) => !e.program_id) ? [{ key: "none", name: "Ohne Zuordnung" }] : []),
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tiles.map((p) => {
        const mine = entries.filter((e) => (e.program_id ?? "none") === p.key);
        const count = (v: "waiting" | "offered" | "followup" | "declined") =>
          mine.filter((e) => inView(e, v)).length;
        const offered = count("offered");
        const followup = count("followup");
        const declined = count("declined");
        const free = p.key === "none" ? 0 : freeForProgram(p.key);
        const selected = filter?.length === 1 && filter[0] === p.key;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onFilter(selected ? null : [p.key])}
            className={`rounded-lg border bg-card p-4 text-left transition hover:shadow-soft ${
              selected ? "ring-2 ring-primary" : ""
            } ${mine.length === 0 ? "opacity-60" : ""}`}
          >
            <div className="font-semibold text-primary-deep">{p.name}</div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <Badge variant="outline">{count("waiting")} wartend</Badge>
              {offered > 0 && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-900">
                  {offered} Angebot(e)
                </Badge>
              )}
              {followup > 0 && <Badge variant="secondary">{followup} Rückfrage(n)</Badge>}
              {declined > 0 && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-900">
                  {declined} mit Absage
                </Badge>
              )}
              {free > 0 && (
                <Badge className="bg-success text-success-foreground hover:bg-success">
                  {free} Platz/Plätze frei
                </Badge>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
