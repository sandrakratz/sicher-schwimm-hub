import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateBerlin } from "@/lib/format";
import { declineTone, type WaitlistData } from "./logic";
import { SuggestionActions } from "./ui";

type Cancellation = WaitlistData["cancellations"][number];

const kindText = (c: Cancellation) =>
  c.kind === "transfer"
    ? `Umbuchung → ${c.moved_to}`
    : c.kind === "waitlist"
      ? "Zurück auf Warteliste"
      : "Absage im Kurs";

const HEAD = ["Kind", "E-Mail", "Kurs", "Datum", "Art / Grund", "Gesamt", "Sperrliste"];

/** Stornierungen gebuchter Plätze (zählen wie Absagen) mit Sperrvorschlag. */
export function CancellationsCard({
  cancellations,
  onBlock,
  onDismiss,
}: {
  cancellations: Cancellation[];
  onBlock: (c: Cancellation) => void;
  onDismiss: (c: Cancellation) => void;
}) {
  return (
    <CollapsibleCard
      storageKey="waitlist-cancellations"
      title="Stornierungen gebuchter Plätze"
      meta={<span className="text-sm text-muted-foreground">{cancellations.length} Einträge</span>}
      contentClassName="overflow-x-auto"
    >
      <p className="mb-2 text-xs text-muted-foreground">
        Absagen in der Teilnehmerliste, Umbuchungen und „zurück auf die Warteliste“ durch die
        Familie. Jede zählt wie eine Absage. Kursabsagen des Vereins zählen nicht.
      </p>
      <Table className="w-full min-w-[800px] text-sm">
        <TableHeader>
          <TableRow className="border-b text-left text-muted-foreground">
            {HEAD.map((h) => (
              <TableHead key={h} className="py-2 pr-3 h-auto pl-0">
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {cancellations.map((c) => (
            <TableRow key={c.id} className="border-b align-top">
              <TableCell className="py-2 pr-3 font-medium pl-0">
                {c.parent_email ? (
                  <Link
                    to="/admin/familie"
                    search={{ email: c.parent_email }}
                    className="text-primary underline underline-offset-2"
                  >
                    {c.child_name ?? "–"}
                  </Link>
                ) : (
                  (c.child_name ?? "–")
                )}
              </TableCell>
              <TableCell className="py-2 pr-3 pl-0">{c.parent_email ?? "–"}</TableCell>
              <TableCell className="py-2 pr-3 pl-0">{c.course_name}</TableCell>
              <TableCell className="py-2 pr-3 whitespace-nowrap pl-0">
                {c.cancelled_at ? formatDateBerlin(c.cancelled_at) : "–"}
              </TableCell>
              <TableCell className="py-2 pr-3 pl-0">
                <Badge variant="secondary">{kindText(c)}</Badge>
                {c.reason && <div className="mt-1 text-xs text-muted-foreground">{c.reason}</div>}
              </TableCell>
              <TableCell className="py-2 pr-3 pl-0">
                <Badge variant="secondary" className={declineTone(c.declines_total)}>
                  {c.declines_total}×
                </Badge>
              </TableCell>
              <TableCell className="py-2 pr-3 text-xs pl-0">
                {c.blocked ? (
                  <span className="text-muted-foreground">gesperrt</span>
                ) : c.block_suggestion ? (
                  <div className="flex flex-wrap gap-2">
                    <span className="font-semibold text-red-900">prüfen:</span>
                    <SuggestionActions onBlock={() => onBlock(c)} onDismiss={() => onDismiss(c)} />
                  </div>
                ) : (
                  "–"
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CollapsibleCard>
  );
}
