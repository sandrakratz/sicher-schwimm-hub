import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTimeBerlin } from "@/lib/format";
import { weekdayDate } from "@/lib/familienschwimmen";
import {
  applyFamilySwimAllocation,
  proposeFamilySwim,
  type AdminEvent,
  type ProposalView,
} from "@/lib/familienschwimmen.functions";

/**
 * Faire Vergabe fürs Mitgliederschwimmen: Vorschlag berechnen, Vorstand übernimmt per Klick.
 * Genutzt auf der Seite „Mitgliederschwimmen“ und im Eingang.
 */
export function Vergabe({ events, reload }: { events: AdminEvent[]; reload: () => Promise<void> }) {
  const now = Date.now();
  const candidates = events.filter(
    (e) => e.status === "open" && e.requestedFamilies + e.waitlistFamilies > 0,
  );
  const [picked, setPicked] = useState<string[]>(() =>
    candidates
      .filter((e) => new Date(e.registration_deadline).getTime() < now && !e.allocated_at)
      .map((e) => e.id),
  );
  const [proposal, setProposal] = useState<ProposalView | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) => {
    setProposal(null);
    setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  };

  async function compute() {
    setBusy(true);
    try {
      setProposal(await proposeFamilySwim({ data: { eventIds: picked } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Vorschlag fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (
      !confirm(
        "Vergabe jetzt übernehmen? Alle betroffenen Familien bekommen eine E-Mail (Zusage oder Warteliste).",
      )
    )
      return;
    setBusy(true);
    try {
      const r = await applyFamilySwimAllocation({ data: { eventIds: picked } });
      toast.success(
        `${r.confirmed} Zusagen, ${r.waitlist} Warteliste, ${r.mails} Mails verschickt.`,
      );
      setProposal(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Vergabe fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-primary-deep">Faire Vergabe</h2>
      <p className="text-sm text-muted-foreground max-w-3xl">
        Erst ein Vorschlag, dann übernehmen. In jeder Runde bekommt jede Familie höchstens einen
        weiteren Termin. Reihenfolge: Teilnahmen plus Strafpunkte (weniger zuerst), dann weniger
        bereits zugesagte Termine, dann längere Zeit seit der letzten Teilnahme, dann der Zeitpunkt
        der Anmeldung. Familien werden nie teilweise angenommen.
      </p>
      {candidates.length === 0 ? (
        <p className="text-sm">Aktuell gibt es keine offenen Anfragen.</p>
      ) : (
        <div className="space-y-2">
          {candidates.map((e) => (
            <label key={e.id} className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={picked.includes(e.id)} onCheckedChange={() => toggle(e.id)} />
              <span className="text-sm">
                {weekdayDate(e.event_date)} · {e.requestedFamilies} offene, {e.waitlistFamilies} auf
                der Warteliste · Anmeldeschluss {formatDateTimeBerlin(e.registration_deadline)}
                {new Date(e.registration_deadline).getTime() > now && (
                  <span className="text-amber-700"> (noch nicht abgelaufen)</span>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || picked.length === 0} onClick={compute}>
          Vorschlag berechnen
        </Button>
        {proposal && (
          <Button size="sm" disabled={busy} onClick={apply}>
            Vergabe übernehmen
          </Button>
        )}
      </div>

      {proposal && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Termin</TableHead>
              <TableHead>Familie</TableHead>
              <TableHead>Personen</TableHead>
              <TableHead>Teilnahmen / Strafpunkte</TableHead>
              <TableHead>Ergebnis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proposal.rows.map((r) => (
              <TableRow key={r.requestId}>
                <TableCell>{weekdayDate(r.eventDate)}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.seats}</TableCell>
                <TableCell>
                  {r.participations} / {r.strikes}
                  {r.pendingConfirmed > 0 && ` · ${r.pendingConfirmed} Termin(e) schon zugesagt`}
                </TableCell>
                <TableCell>
                  {r.outcome === "confirmed" ? (
                    <Badge>Zusage (Runde {r.round})</Badge>
                  ) : (
                    <Badge variant="secondary">Warteliste</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
