import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useServerFn } from "@tanstack/react-start";
import { listActiveMembers, type ActiveMember } from "@/lib/members-list.functions";
import { formatDateBerlin } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/mitglieder")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/admin-guard.functions");
    const { redirect } = await import("@tanstack/react-router");
    try { await assertHasAnyRole({ data: { roles: ["admin", "board", "trainer"] } }); }
    catch { throw redirect({ to: "/portal" }); }
  },
  component: Page,
  head: () => ({
    meta: [
      { title: "Aktive Vereinsmitglieder | Sicher Schwimmen e.V." },
      { name: "description", content: "Interne Übersicht der aktiven Vereinsmitglieder des Sicher Schwimmen e.V." },
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
  const load = useServerFn(listActiveMembers);

  useEffect(() => {
    (async () => {
      try {
        setRows(await load());
      } catch (e: any) {
        toast.error(e?.message || "Laden fehlgeschlagen");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.name.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Vereinsmitglieder</h1>
          <p className="text-sm text-muted-foreground">Aktive Mitglieder des Vereins (nur Ansicht).</p>
        </div>
        <Badge variant="secondary">{filtered.length} aktiv</Badge>
      </div>

      <Input
        placeholder="Nach Name suchen…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="max-w-sm"
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Mitgliedsart</TableHead>
                <TableHead>Mitglied seit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={3} className="text-muted-foreground">Lädt…</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-muted-foreground">Keine aktiven Mitglieder gefunden.</TableCell></TableRow>
              )}
              {filtered.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name || "—"}</TableCell>
                  <TableCell>{TYPE_LABEL[m.membership_type] || m.membership_type}</TableCell>
                  <TableCell>{formatDateBerlin(m.member_since)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
