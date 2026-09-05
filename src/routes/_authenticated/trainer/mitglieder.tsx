import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useServerFn } from "@tanstack/react-start";
import { listActiveMembers, type ActiveMember } from "@/lib/members-list.functions";
import { formatDateBerlin } from "@/lib/format";
import { toast } from "sonner";
import { MemberCard } from "@/components/trainer/MemberCard";

export const Route = createFileRoute("/_authenticated/trainer/mitglieder")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/admin-guard.functions");
    const { redirect } = await import("@tanstack/react-router");
    try { await assertHasAnyRole({ data: { roles: ["admin", "board", "trainer"] } }); }
    catch { throw redirect({ to: "/portal" }); }
  },
  component: Page,
  head: () => ({
    meta: [
      { title: "Vereinsmitglieder – Trainerbereich | Sicher Schwimmen e.V." },
      { name: "description", content: "Interne Übersicht aller aktiven Vereinsmitglieder inklusive Familienmitgliedern." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const TYPE_LABEL: Record<string, string> = {
  children_youth: "Kinder & Jugend",
  adult: "Erwachsene",
  family: "Familie",
  supporting: "Förderung",
};

function Page() {
  const [rows, setRows] = useState<ActiveMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(20);
  const load = useServerFn(listActiveMembers);

  useEffect(() => {
    (async () => {
      try {
        setRows(await load());
      } catch (e: unknown) {
        toast.error((e as Error)?.message || "Laden fehlgeschlagen");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      [r.name, r.email ?? "", r.partner?.name ?? "", ...r.children.map(c => c.name)]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  const totalPeople = useMemo(
    () => filtered.reduce((sum, m) => sum + 1 + (m.partner ? 1 : 0) + m.children.length, 0),
    [filtered],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Vereinsmitglieder</h1>
          <p className="text-sm text-muted-foreground">
            Aktive Mitgliedschaften inkl. Familienmitgliedern (nur Ansicht, keine Bankdaten).
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{filtered.length} Mitgliedschaften</Badge>
          <Badge variant="secondary">{totalPeople} Personen</Badge>
        </div>
      </div>

      <Input
        placeholder="Nach Name oder E-Mail suchen…"
        value={query}
        onChange={e => { setQuery(e.target.value); setVisible(20); }}
        className="h-11 max-w-sm"
      />

      <CollapsibleCard
        title="Mitgliederliste"
        subtitle="Klicken zum Ein- und Ausklappen"
        storageKey="trainer-mitglieder"
        contentClassName="px-0"
      >
          <div className="md:hidden">
            {loading && <p className="px-4 py-3 text-sm text-muted-foreground">Lädt…</p>}
            {!loading && filtered.length === 0 && (
              <p className="px-4 py-3 text-sm text-muted-foreground">Keine aktiven Mitglieder gefunden.</p>
            )}
            {filtered.slice(0, visible).map(m => (
              <MemberCard key={m.id} m={m as any} />
            ))}
            {filtered.length > visible && (
              <button
                type="button"
                onClick={() => setVisible(v => v + 20)}
                className="min-h-12 w-full text-sm font-semibold text-primary"
              >
                Mehr anzeigen ({filtered.length - visible})
              </button>
            )}
          </div>

          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Geburtsdatum</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Mitgliedsart</TableHead>
                <TableHead>Mitglied seit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={7} className="text-muted-foreground">Lädt…</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-muted-foreground">Keine aktiven Mitglieder gefunden.</TableCell></TableRow>
              )}
              {filtered.map(m => (
                <Fragment key={m.id}>
                  <TableRow>
                    <TableCell className="font-medium">{m.name || "—"}</TableCell>
                    <TableCell><Badge variant="secondary">Hauptmitglied</Badge></TableCell>
                    <TableCell>{m.date_of_birth ? formatDateBerlin(m.date_of_birth) : "—"}</TableCell>
                    <TableCell>{m.phone || "—"}</TableCell>
                    <TableCell>{m.email || "—"}</TableCell>
                    <TableCell>{TYPE_LABEL[m.membership_type] || m.membership_type}</TableCell>
                    <TableCell>{formatDateBerlin(m.member_since)}</TableCell>
                  </TableRow>
                  {m.partner && (
                    <TableRow key={`${m.id}-partner`} className="bg-muted/30">
                      <TableCell className="pl-8">{m.partner.name}</TableCell>
                      <TableCell><Badge variant="outline">Partner:in</Badge></TableCell>
                      <TableCell>{m.partner.date_of_birth ? formatDateBerlin(m.partner.date_of_birth) : "—"}</TableCell>
                      <TableCell>{m.phone || "—"}</TableCell>
                      <TableCell>{m.email || "—"}</TableCell>
                      <TableCell colSpan={2} className="text-xs text-muted-foreground">über {m.name}</TableCell>
                    </TableRow>
                  )}
                  {m.children.map((c, i) => (
                    <TableRow key={`${m.id}-child-${i}`} className="bg-muted/30">
                      <TableCell className="pl-8">{c.name}</TableCell>
                      <TableCell><Badge variant="outline">Kind</Badge></TableCell>
                      <TableCell>{c.date_of_birth ? formatDateBerlin(c.date_of_birth) : "—"}</TableCell>
                      <TableCell>{m.phone || "—"}</TableCell>
                      <TableCell>{m.email || "—"}</TableCell>
                      <TableCell colSpan={2} className="text-xs text-muted-foreground">über {m.name}</TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
          </div>
      </CollapsibleCard>
    </div>
  );
}
