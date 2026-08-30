import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Trash2, ShieldBan } from "lucide-react";
import { formatDateBerlin, formatDateTimeBerlin } from "@/lib/format";
import {
  listBlocklist, addBlocklistEntry, setBlocklistActive, deleteBlocklistEntry,
  type BlocklistEntry,
} from "@/lib/blocklist.functions";

export const Route = createFileRoute("/_authenticated/admin/sperrliste")({
  ssr: false,
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/admin-guard.functions");
    const { redirect } = await import("@tanstack/react-router");
    try { await assertHasAnyRole({ data: { roles: ["admin", "board"] } }); }
    catch { throw redirect({ to: "/portal" }); }
  },
  component: Page,
  head: () => ({
    meta: [
      { title: "Sperrliste – Adminbereich | Sicher Schwimmen e.V." },
      { name: "description", content: "Verwaltung gesperrter Teilnehmer, die keine Kurse direkt online buchen können." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function Page() {
  const [entries, setEntries] = useState<BlocklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ childName: "", childDob: "", email: "", reason: "" });

  async function load() {
    setLoading(true);
    try {
      const res = await listBlocklist();
      setEntries(res.entries);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sperrliste konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function add() {
    setSaving(true);
    try {
      await addBlocklistEntry({ data: form });
      toast.success("Eintrag hinzugefügt.");
      setForm({ childName: "", childDob: "", email: "", reason: "" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eintrag konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(e: BlocklistEntry) {
    try {
      await setBlocklistActive({ data: { id: e.id, active: !e.active } });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Änderung fehlgeschlagen.");
    }
  }

  async function remove(e: BlocklistEntry) {
    if (!confirm("Diesen Eintrag endgültig löschen?")) return;
    try {
      await deleteBlocklistEntry({ data: { id: e.id } });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary-deep flex items-center gap-2">
          <ShieldBan className="h-7 w-7" /> Sperrliste
        </h1>
        <p className="text-muted-foreground mt-1">
          Gesperrte Teilnehmer können keinen Kurs direkt online buchen. Ihre Angaben landen stattdessen als Kursanfrage
          zur Einzelfallprüfung im Bereich „Kursanfragen“. Abgelehnte Kursanfragen werden automatisch übernommen.
        </p>
      </div>

      <Card className="border-0 shadow-soft">
        <CardHeader><CardTitle className="text-lg">Eintrag hinzufügen</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label htmlFor="bl-child">Name des Kindes</Label>
              <Input id="bl-child" value={form.childName} onChange={(e) => setForm(f => ({ ...f, childName: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bl-dob">Geburtsdatum</Label>
              <Input id="bl-dob" type="date" value={form.childDob} onChange={(e) => setForm(f => ({ ...f, childDob: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bl-email">E-Mail der Eltern</Label>
              <Input id="bl-email" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bl-reason">Grund</Label>
              <Input id="bl-reason" value={form.reason} onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Es genügt entweder eine E-Mail-Adresse oder Kindname zusammen mit dem Geburtsdatum.
          </p>
          <Button onClick={add} disabled={saving}>{saving ? "Wird gespeichert…" : "Hinzufügen"}</Button>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-soft">
        <CardHeader><CardTitle className="text-lg">Einträge ({entries.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground py-6 text-center">Wird geladen…</div>
          ) : entries.length === 0 ? (
            <div className="text-muted-foreground py-6 text-center">Keine Einträge vorhanden.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kind</TableHead>
                  <TableHead>Geburtsdatum</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Grund</TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id} className={e.active ? "" : "opacity-60"}>
                    <TableCell className="capitalize">{e.child_name_norm || "—"}</TableCell>
                    <TableCell>{e.child_dob ? formatDateBerlin(e.child_dob) : "—"}</TableCell>
                    <TableCell>{e.email_norm || "—"}</TableCell>
                    <TableCell>{e.reason || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={e.source === "manual" ? "secondary" : "outline"}>
                        {e.source === "manual" ? "manuell" : "Ablehnung"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTimeBerlin(e.created_at)}</TableCell>
                    <TableCell className="text-right space-x-2 whitespace-nowrap">
                      <Button size="sm" variant={e.active ? "outline" : "default"} onClick={() => toggle(e)}>
                        {e.active ? "Deaktivieren" : "Aktivieren"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(e)} aria-label="Eintrag löschen">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
