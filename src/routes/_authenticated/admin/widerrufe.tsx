import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Search, Eye } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { listCancellations, setCancellationStatus } from "@/lib/cancellation.functions";
import { formatDateBerlin, formatDateTimeBerlin } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/widerrufe")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/admin-guard.functions");
    const { redirect } = await import("@tanstack/react-router");
    try { await assertHasAnyRole({ data: { roles: ["admin", "board"] } }); }
    catch { throw redirect({ to: "/admin/benutzer" }); }
  },
  component: Page,
});

type Row = {
  id: string;
  reference_number: string;
  parent_first_name: string;
  parent_last_name: string;
  email: string;
  phone: string;
  child_name: string;
  course_name: string;
  booking_date: string;
  notes: string | null;
  revocation_text: string;
  ip_address: string | null;
  user_agent: string | null;
  status: "eingegangen" | "in_bearbeitung" | "abgeschlossen";
  created_at: string;
};

const STATUS_LABEL: Record<Row["status"], string> = {
  eingegangen: "Eingegangen",
  in_bearbeitung: "In Bearbeitung",
  abgeschlossen: "Abgeschlossen",
};
const STATUS_VARIANT: Record<Row["status"], "secondary" | "default" | "outline"> = {
  eingegangen: "secondary",
  in_bearbeitung: "default",
  abgeschlossen: "outline",
};

function Page() {
  const listFn = useServerFn(listCancellations);
  const setStatusFn = useServerFn(setCancellationStatus);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detail, setDetail] = useState<Row | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await listFn({
        data: {
          status: status === "all" ? undefined : (status as Row["status"]),
          search: search || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      });
      setRows(res.rows as Row[]);
    } catch (e: any) {
      toast.error(e?.message || "Konnte Widerrufe nicht laden");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status, from, to]);

  async function changeStatus(id: string, next: Row["status"]) {
    try {
      await setStatusFn({ data: { id, status: next } });
      toast.success("Status aktualisiert");
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: next } : r)));
      if (detail && detail.id === id) setDetail({ ...detail, status: next });
    } catch (e: any) {
      toast.error(e?.message || "Konnte Status nicht ändern");
    }
  }

  const csvHref = useMemo(() => {
    const header = [
      "Referenz", "Eingegangen", "Status", "Vorname", "Nachname", "E-Mail",
      "Telefon", "Kind", "Kurs", "Buchungsdatum", "Bemerkungen", "Widerrufstext", "IP",
    ];
    const csv = [header.join(";")].concat(
      rows.map((r) => [
        r.reference_number, formatDateTimeBerlin(r.created_at), STATUS_LABEL[r.status],
        r.parent_first_name, r.parent_last_name, r.email, r.phone, r.child_name,
        r.course_name, r.booking_date, (r.notes || "").replace(/[\r\n;]/g, " "),
        r.revocation_text.replace(/[\r\n;]/g, " "), r.ip_address || "",
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")),
    ).join("\n");
    return "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csv);
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl font-bold text-primary-deep">Widerrufe</h1>
        <Button asChild variant="outline">
          <a href={csvHref} download={`widerrufe-${new Date().toISOString().slice(0, 10)}.csv`}>
            <Download className="h-4 w-4" /> CSV-Export
          </a>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-4 mb-4">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="eingegangen">Eingegangen</SelectItem>
                  <SelectItem value="in_bearbeitung">In Bearbeitung</SelectItem>
                  <SelectItem value="abgeschlossen">Abgeschlossen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Von</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Bis</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Suche</Label>
              <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2">
                <Input placeholder="Name, E-Mail, Referenz…" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Button type="submit" variant="outline" size="icon" aria-label="Suchen">
                  <Search className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referenz</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Eltern</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Kurs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7}>Lädt…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-muted-foreground">Keine Widerrufe gefunden.</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.reference_number}</TableCell>
                    <TableCell>{formatDateTimeBerlin(r.created_at)}</TableCell>
                    <TableCell>{r.parent_first_name} {r.parent_last_name}<div className="text-xs text-muted-foreground">{r.email}</div></TableCell>
                    <TableCell>{r.child_name}</TableCell>
                    <TableCell>{r.course_name}<div className="text-xs text-muted-foreground">Gebucht: {formatDateBerlin(r.booking_date)}</div></TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Select value={r.status} onValueChange={(v) => changeStatus(r.id, v as Row["status"])}>
                          <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="eingegangen">Eingegangen</SelectItem>
                            <SelectItem value="in_bearbeitung">In Bearbeitung</SelectItem>
                            <SelectItem value="abgeschlossen">Abgeschlossen</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" onClick={() => setDetail(r)} aria-label="Details">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Widerruf {detail?.reference_number}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-2 text-sm">
              <Row label="Eingegangen" value={formatDateTimeBerlin(detail.created_at)} />
              <Row label="Status" value={STATUS_LABEL[detail.status]} />
              <Row label="Eltern" value={`${detail.parent_first_name} ${detail.parent_last_name}`} />
              <Row label="E-Mail" value={detail.email} />
              <Row label="Telefon" value={detail.phone} />
              <Row label="Kind" value={detail.child_name} />
              <Row label="Kurs" value={detail.course_name} />
              <Row label="Buchungsdatum" value={formatDateBerlin(detail.booking_date)} />
              <Row label="Bemerkungen" value={detail.notes || "—"} />
              <div>
                <div className="text-xs text-muted-foreground">Widerrufstext</div>
                <div className="whitespace-pre-wrap rounded border p-3 bg-muted/40 mt-1">{detail.revocation_text}</div>
              </div>
              <Row label="IP-Adresse" value={detail.ip_address || "—"} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-1 border-b last:border-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="col-span-2">{value}</div>
    </div>
  );
}
