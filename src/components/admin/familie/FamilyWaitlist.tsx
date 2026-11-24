import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listWaitlist } from "@/lib/waitlist.functions";
import { EntryRow } from "@/components/admin/warteliste/EntryRow";
import { OriginalRequestDialog } from "@/components/admin/warteliste/OriginalRequestDialog";
import { DeclineOfferDialog } from "@/components/admin/warteliste/DeclineOfferDialog";
import {
  WAITLIST_QUERY_KEY,
  useWaitlistMutations,
} from "@/components/admin/warteliste/useWaitlistMutations";
import type { WaitlistEntry } from "@/components/admin/warteliste/logic";

const HEAD = ["Kind", "Eltern", "Status", "Zuständig", "Aktion"];

/**
 * Die Wartelisten-Einträge einer Familie – dieselben Zeilen und Knöpfe wie in der Anfrageliste
 * (Platz anbieten, direkt buchen, Absage, abmelden, Notiz, Zuständigkeit), samt Dialogen.
 */
export function FamilyWaitlist({ entryIds }: { entryIds: string[] }) {
  const { data, isLoading, error } = useQuery({
    queryKey: WAITLIST_QUERY_KEY,
    queryFn: () => listWaitlist(),
  });
  const m = useWaitlistMutations();
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<WaitlistEntry | null>(null);
  const [declineFor, setDeclineFor] = useState<WaitlistEntry | null>(null);

  if (error)
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Anfrageliste konnte nicht geladen werden"}
      </p>
    );
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Wird geladen …</p>;
  const ids = new Set(entryIds);
  const entries = data.entries.filter((e) => ids.has(e.id));
  if (entries.length === 0)
    return <p className="text-sm text-muted-foreground">Keine Einträge auf der Anfrageliste.</p>;
  const courseName = (id: unknown) => data.courses.find((c) => c.id === id)?.name ?? "Kurs";
  const toggle = (id: string) =>
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <>
      <div className="overflow-x-auto">
        <Table className="w-full min-w-[820px] text-sm">
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
            {entries.map((e) => (
              <EntryRow
                key={e.id}
                e={e}
                data={data}
                courseName={courseName}
                open={openRows.has(e.id)}
                onToggle={() => toggle(e.id)}
                onDetail={() => setDetail(e)}
                onDecline={() => setDeclineFor(e)}
                m={m}
              />
            ))}
          </TableBody>
        </Table>
      </div>
      <OriginalRequestDialog
        key={`detail-${detail?.id ?? ""}`}
        entry={detail}
        onClose={() => setDetail(null)}
        saving={m.update.isPending}
        onSave={(patch) =>
          m.update.mutate(patch, {
            onSuccess: () => {
              toast.success("Angaben gespeichert");
              setDetail(null);
            },
          })
        }
      />
      <DeclineOfferDialog
        key={`decline-${declineFor?.id ?? ""}`}
        entry={declineFor}
        onClose={() => setDeclineFor(null)}
        saving={m.recordDecline.isPending}
        onSave={(v) => m.recordDecline.mutate(v, { onSuccess: () => setDeclineFor(null) })}
      />
    </>
  );
}
