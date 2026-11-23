import { Badge } from "@/components/ui/badge";
import { formatDateBerlin } from "@/lib/format";
import { categorizeReason, NO_REASON } from "@/lib/decline-reasons";
import { relatedProgramIds } from "@/lib/waitlist-programs";
import type { listWaitlist } from "@/lib/waitlist.functions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Data = Awaited<ReturnType<typeof listWaitlist>>;

/** Nachfrage je Angebot: wartende Familien gegen freie Plätze, Wartezeit und Absagen. */
export function WaitlistReport({ data }: { data: Data | undefined }) {
  const entries = data?.entries ?? [];
  const programs = data?.programs ?? [];
  const courses = data?.courses ?? [];
  const now = Date.now();

  const rows = [
    ...programs.map((p) => ({ id: p.id as string | null, name: p.name })),
    ...(entries.some((e) => !e.program_id)
      ? [{ id: null as string | null, name: "Ohne Zuordnung" }]
      : []),
  ].map((p) => {
    const mine = entries.filter((e) => (e.program_id ?? null) === p.id);
    const waiting = mine.filter((e) => e.status === "waiting");
    const members = waiting.filter((e) => e.is_member === true).length;
    const free = p.id
      ? courses
          .filter(
            (c) => c.free != null && relatedProgramIds(c.program_id, programs).includes(p.id!),
          )
          .reduce((s, c) => s + (c.free ?? 0), 0)
      : 0;
    const days = waiting.map((e) => (now - new Date(e.created_at).getTime()) / 86400000);
    const avg = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0;
    const oldest = waiting.length
      ? waiting.reduce((a, b) => (a.created_at < b.created_at ? a : b)).created_at
      : null;
    const declines = mine.reduce(
      (s, e) => s + Number((e as Record<string, unknown>)["decline_count"] ?? 0),
      0,
    );
    const reasonCount = new Map<string, number>();
    for (const e of mine) {
      const r = (e as Record<string, unknown>)["last_decline_reason"];
      if (
        Number((e as Record<string, unknown>)["decline_count"] ?? 0) > 0 &&
        typeof r === "string"
      ) {
        const c = categorizeReason(r);
        if (c !== NO_REASON) reasonCount.set(c, (reasonCount.get(c) ?? 0) + 1);
      }
    }
    const topReason = [...reasonCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const overhang = waiting.length - free;
    return {
      ...p,
      waiting: waiting.length,
      members,
      free,
      avg,
      oldest,
      declines,
      topReason,
      overhang,
    };
  });

  const active = rows.filter((r) => r.waiting > 0 || r.free > 0 || r.declines > 0);
  const total = active.reduce(
    (t, r) => ({
      waiting: t.waiting + r.waiting,
      free: t.free + r.free,
      declines: t.declines + r.declines,
    }),
    { waiting: 0, free: 0, declines: 0 },
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Wartende Familien gegen freie Plätze je Angebot. „Überhang“ = wartende Familien minus freie
        Plätze: Ab 5 lohnt sich in der Regel ein zusätzlicher Kurs. Mischkurse (Aufbaukurs) zählen
        die Plätze für Bronze, Silber und Gold mit.
      </p>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table className="w-full min-w-[900px] text-sm">
          <TableHeader>
            <TableRow className="border-b text-left text-muted-foreground">
              <TableHead className="p-3 h-auto">Angebot</TableHead>
              <TableHead className="p-3 h-auto">Wartend</TableHead>
              <TableHead className="p-3 h-auto">davon Mitglieder</TableHead>
              <TableHead className="p-3 h-auto">Freie Plätze</TableHead>
              <TableHead className="p-3 h-auto">Überhang</TableHead>
              <TableHead className="p-3 h-auto">Ø Wartezeit</TableHead>
              <TableHead className="p-3 h-auto">Älteste Anfrage</TableHead>
              <TableHead className="p-3 h-auto">Absagen</TableHead>
              <TableHead className="p-3 h-auto">Häufigster Grund</TableHead>
              <TableHead className="p-3 h-auto">Empfehlung</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {active.map((r) => (
              <TableRow key={r.id ?? "none"} className="border-b">
                <TableCell className="p-3 font-medium">{r.name}</TableCell>
                <TableCell className="p-3">{r.waiting}</TableCell>
                <TableCell className="p-3">{r.members}</TableCell>
                <TableCell className="p-3">{r.free}</TableCell>
                <TableCell className="p-3">{r.overhang > 0 ? r.overhang : 0}</TableCell>
                <TableCell className="p-3">{r.waiting ? `${r.avg} Tage` : "–"}</TableCell>
                <TableCell className="p-3">{r.oldest ? formatDateBerlin(r.oldest) : "–"}</TableCell>
                <TableCell className="p-3">{r.declines}</TableCell>
                <TableCell className="p-3">{r.topReason ?? "–"}</TableCell>
                <TableCell className="p-3">
                  {r.overhang >= 5 ? (
                    <Badge className="bg-red-100 text-red-900" variant="secondary">
                      Zusätzlicher Kurs sinnvoll
                    </Badge>
                  ) : r.overhang >= 3 ? (
                    <Badge className="bg-amber-100 text-amber-900" variant="secondary">
                      Beobachten
                    </Badge>
                  ) : r.free > 0 && r.waiting > 0 ? (
                    <Badge className="bg-sky-100 text-sky-900" variant="secondary">
                      Plätze vergeben
                    </Badge>
                  ) : (
                    "–"
                  )}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold">
              <TableCell className="p-3">Gesamt</TableCell>
              <TableCell className="p-3">{total.waiting}</TableCell>
              <TableCell className="p-3" />
              <TableCell className="p-3">{total.free}</TableCell>
              <TableCell className="p-3" colSpan={3} />
              <TableCell className="p-3">{total.declines}</TableCell>
              <TableCell className="p-3" colSpan={2} />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
