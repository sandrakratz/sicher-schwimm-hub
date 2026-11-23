import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateBerlin } from "@/lib/format";
import { NoteCell, SharkyButton, StatusBadge, type Sharky } from "./parts";
import type { CourseLabel, Item } from "./types";

/** „waiting“ = Warteliste (mit Platz und Geburtsdatum), sonst ein Reiter der Kursanfragen. */
export type TableKind = "waiting" | "open" | "assigned" | "rejected";

const EMPTY: Record<Exclude<TableKind, "waiting">, string> = {
  open: "Keine offenen Anfragen in dieser Kategorie.",
  assigned: "Noch keine Anfrage einem Kurs zugewiesen.",
  rejected: "Keine abgelehnten Anfragen.",
};

export function RequestTable({
  items,
  kind,
  onOpen,
  courseLabel,
  sharky,
}: {
  items: Item[];
  kind: TableKind;
  onOpen: (item: Item) => void;
  courseLabel: CourseLabel;
  sharky: Sharky;
}) {
  const waiting = kind === "waiting";
  if (!items.length && !waiting)
    return <div className="px-4 py-6 text-sm text-muted-foreground text-center">{EMPTY[kind]}</div>;

  function courseCell(r: Item) {
    if (kind !== "assigned") return r.desired_course || "—";
    const cl = courseLabel(r.assigned_course_id);
    if (!cl) return "—";
    return (
      <div>
        <div className="font-medium">{cl.name}</div>
        {cl.period && <div className="text-xs text-muted-foreground">{cl.period}</div>}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {waiting && <TableHead className="w-12">#</TableHead>}
          <TableHead>{waiting ? "Eingang" : "Datum"}</TableHead>
          <TableHead>Eltern</TableHead>
          <TableHead>Kind</TableHead>
          {waiting && <TableHead>Geburtsdatum</TableHead>}
          <TableHead>{kind === "assigned" ? "Zugewiesener Kurs" : "Wunschkurs"}</TableHead>
          {!waiting && <TableHead>Status</TableHead>}
          <TableHead>Sharky</TableHead>
          <TableHead>Notiz &amp; Hinweise</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((r, i) => (
          <TableRow key={r.id} className="cursor-pointer" onClick={() => onOpen(r)}>
            {waiting && <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>}
            <TableCell className="text-xs">{formatDateBerlin(r.created_at)}</TableCell>
            <TableCell>
              <div className="font-semibold">{r.parent_name}</div>
              <div className="text-xs text-muted-foreground">{r.parent_email}</div>
            </TableCell>
            <TableCell>{r.child_name || "—"}</TableCell>
            {waiting && (
              <TableCell className="text-xs">
                {r.child_dob ? formatDateBerlin(r.child_dob) : "—"}
              </TableCell>
            )}
            <TableCell>{courseCell(r)}</TableCell>
            {!waiting && (
              <TableCell>
                <StatusBadge status={r.status} />
              </TableCell>
            )}
            <TableCell onClick={(e) => e.stopPropagation()}>
              <SharkyButton item={r} sharky={sharky} />
            </TableCell>
            <TableCell className="max-w-[260px]">
              <NoteCell item={r} />
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(r);
                }}
              >
                Details
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
