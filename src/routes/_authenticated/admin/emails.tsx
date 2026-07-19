import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Eye } from "lucide-react";
import { formatDateTimeBerlin } from "@/lib/format";
import { useServerFn } from "@tanstack/react-start";
import { backfillEmailBodies } from "@/lib/email-backfill.functions";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/admin/emails")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/admin-guard.functions");
    const { redirect } = await import("@tanstack/react-router");
    try { await assertHasAnyRole({ data: { roles: ["admin", "board"] } }); }
    catch { throw redirect({ to: "/admin/benutzer" }); }
  },
  component: Page,
});

type LogRow = {
  id: string;
  message_id: string | null;
  template_name: string | null;
  recipient_email: string | null;
  status: string;
  error_message: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  sent: "Gesendet",
  pending: "In Warteschlange",
  failed: "Fehlgeschlagen",
  dlq: "Fehlgeschlagen",
  suppressed: "Unterdrückt",
  bounced: "Zurückgewiesen",
  complained: "Beschwerde",
};

function statusVariant(s: string): "default" | "destructive" | "secondary" | "outline" {
  if (s === "sent") return "default";
  if (s === "failed" || s === "dlq" || s === "bounced" || s === "complained") return "destructive";
  if (s === "suppressed") return "secondary";
  return "outline";
}

type RangeKey = "24h" | "7d" | "30d" | "all";

function rangeStart(r: RangeKey): Date | null {
  const now = Date.now();
  if (r === "24h") return new Date(now - 24 * 3600 * 1000);
  if (r === "7d") return new Date(now - 7 * 24 * 3600 * 1000);
  if (r === "30d") return new Date(now - 30 * 24 * 3600 * 1000);
  return null;
}

const PAGE_SIZE = 50;

function Page() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("7d");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [recipient, setRecipient] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<LogRow | null>(null);

  useEffect(() => {
    setLoading(true);
    const start = rangeStart(range);
    let q = supabase
      .from("email_send_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (start) q = q.gte("created_at", start.toISOString());
    q.then(({ data }) => {
      setRows((data as LogRow[]) || []);
      setLoading(false);
    });
  }, [range]);

  // Dedupe by message_id (latest per id)
  const deduped = useMemo(() => {
    const map = new Map<string, LogRow>();
    for (const r of rows) {
      const key = r.message_id || r.id;
      const prev = map.get(key);
      if (!prev || new Date(r.created_at) > new Date(prev.created_at)) map.set(key, r);
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [rows]);

  const templates = useMemo(() => {
    const set = new Set<string>();
    for (const r of deduped) if (r.template_name) set.add(r.template_name);
    return Array.from(set).sort();
  }, [deduped]);

  const filtered = useMemo(() => {
    const rq = recipient.trim().toLowerCase();
    return deduped.filter(r => {
      if (templateFilter !== "all" && r.template_name !== templateFilter) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "failed" && !(r.status === "failed" || r.status === "dlq")) return false;
        if (statusFilter !== "failed" && r.status !== statusFilter) return false;
      }
      if (rq && !(r.recipient_email || "").toLowerCase().includes(rq)) return false;
      return true;
    });
  }, [deduped, templateFilter, statusFilter, recipient]);

  useEffect(() => { setPage(0); }, [templateFilter, statusFilter, recipient, range]);

  const stats = useMemo(() => {
    let sent = 0, failed = 0, suppressed = 0;
    for (const r of filtered) {
      if (r.status === "sent") sent++;
      else if (r.status === "failed" || r.status === "dlq" || r.status === "bounced") failed++;
      else if (r.status === "suppressed") suppressed++;
    }
    return { total: filtered.length, sent, failed, suppressed };
  }, [filtered]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-3xl font-bold text-primary-deep">Gesendete E-Mails</h1>
        <div className="flex gap-2 flex-wrap items-center">
          {(["24h", "7d", "30d", "all"] as RangeKey[]).map(k => (
            <Button key={k} size="sm" variant={range === k ? "default" : "outline"} onClick={() => setRange(k)}>
              {k === "24h" ? "24 Std" : k === "7d" ? "7 Tage" : k === "30d" ? "30 Tage" : "Alle"}
            </Button>
          ))}
          <BackfillButton />
        </div>
      </div>


      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Gesamt" value={stats.total} />
        <StatCard label="Gesendet" value={stats.sent} tone="success" />
        <StatCard label="Fehlgeschlagen" value={stats.failed} tone="danger" />
        <StatCard label="Unterdrückt" value={stats.suppressed} tone="muted" />
      </div>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="min-w-48">
            <label className="text-xs font-semibold text-muted-foreground">Template</label>
            <Select value={templateFilter} onValueChange={setTemplateFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {templates.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-40">
            <label className="text-xs font-semibold text-muted-foreground">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="sent">Gesendet</SelectItem>
                <SelectItem value="failed">Fehlgeschlagen</SelectItem>
                <SelectItem value="suppressed">Unterdrückt</SelectItem>
                <SelectItem value="pending">In Warteschlange</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-56">
            <label className="text-xs font-semibold text-muted-foreground">Empfänger</label>
            <Input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="E-Mail suchen …" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-0">
          {loading ? (
            <p className="text-center text-muted-foreground py-10">Lade …</p>
          ) : paged.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">Keine E-Mails im gewählten Zeitraum.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="p-3">Zeitpunkt</th>
                    <th className="p-3">Template</th>
                    <th className="p-3">Empfänger</th>
                    <th className="p-3">Betreff</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(r => (
                    <tr key={r.id} className="border-t">
                      <td className="p-3 whitespace-nowrap text-xs">{formatDateTimeBerlin(r.created_at)}</td>
                      <td className="p-3">{r.template_name || "—"}</td>
                      <td className="p-3">{r.recipient_email || "—"}</td>
                      <td className="p-3 max-w-xs truncate">{r.subject || <span className="text-muted-foreground italic">—</span>}</td>
                      <td className="p-3"><Badge variant={statusVariant(r.status)}>{STATUS_LABEL[r.status] || r.status}</Badge></td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => setSelected(r)}>
                          <Eye className="h-4 w-4 mr-1" />Ansehen
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t">
              <div className="text-xs text-muted-foreground">Seite {page + 1} von {totalPages}</div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Zurück</Button>
                <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>Weiter</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.subject || "E-Mail-Detail"}</DialogTitle>
            <DialogDescription>
              An {selected?.recipient_email} · {selected && formatDateTimeBerlin(selected.created_at)}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant={statusVariant(selected.status)}>{STATUS_LABEL[selected.status] || selected.status}</Badge>
                {selected.template_name && <Badge variant="outline">{selected.template_name}</Badge>}
              </div>
              {selected.error_message && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {selected.error_message}
                </div>
              )}
              {selected.body_html ? (
                <div>
                  <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">HTML-Vorschau</div>
                  <iframe
                    title="E-Mail-Inhalt"
                    sandbox=""
                    srcDoc={selected.body_html}
                    className="w-full h-96 rounded-md border bg-white"
                  />
                </div>
              ) : null}
              {selected.body_text ? (
                <div>
                  <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">Text-Version</div>
                  <pre className="whitespace-pre-wrap text-sm bg-muted/40 rounded-md p-3">{selected.body_text}</pre>
                </div>
              ) : null}
              {!selected.body_html && !selected.body_text && (
                <p className="text-sm text-muted-foreground">Für diese E-Mail wurde kein Inhalt gespeichert (z.&nbsp;B. automatische System- oder Auth-Mail). Betreff, Empfänger und Status sind oben ersichtlich.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" | "muted" }) {
  const color =
    tone === "success" ? "text-emerald-600" :
    tone === "danger" ? "text-destructive" :
    tone === "muted" ? "text-muted-foreground" :
    "text-primary-deep";
  return (
    <Card className="border-0 shadow-soft">
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function BackfillButton() {
  const run = useServerFn(backfillEmailBodies);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      let totalUpdated = 0, totalSkipped = 0, remaining = 0, iterations = 0;
      while (iterations < 20) {
        const res: any = await run({});
        totalUpdated += res.updated || 0;
        totalSkipped += res.skipped || 0;
        remaining = res.remaining || 0;
        iterations++;
        if ((res.updated || 0) + (res.skipped || 0) === 0) break;
      }
      toast.success(`Rekonstruktion abgeschlossen: ${totalUpdated} aktualisiert, ${totalSkipped} übersprungen, ${remaining} verbleibend`);
      window.location.reload();
    } catch (e: any) {
      toast.error(e?.message || "Rekonstruktion fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="sm" variant="secondary" onClick={go} disabled={busy}>
      {busy ? "Rekonstruiere …" : "Inhalte rekonstruieren"}
    </Button>
  );
}

