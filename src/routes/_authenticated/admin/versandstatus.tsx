import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useServerFn } from "@tanstack/react-start";
import { listDeliveryEvents, type DeliveryEvent } from "@/lib/email-logs.functions";
import { formatDateTimeBerlin } from "@/lib/format";
import { RefreshCw } from "lucide-react";
import { TestSendDialog } from "@/components/admin/TestSendDialog";

export const Route = createFileRoute("/_authenticated/admin/versandstatus")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/admin-guard.functions");
    const { redirect } = await import("@tanstack/react-router");
    try { await assertHasAnyRole({ data: { roles: ["admin", "board"] } }); }
    catch { throw redirect({ to: "/admin/benutzer" }); }
  },
  component: Page,
});

const ADMIN_EMAIL = "info@sicher-schwimmen.com";

type RangeKey = "24h" | "7d" | "30d" | "all";

const RANGE_LABEL: Record<RangeKey, string> = {
  "24h": "Letzte 24 Stunden",
  "7d": "Letzte 7 Tage",
  "30d": "Letzte 30 Tage",
  all: "Gesamter Zeitraum",
};

function sinceFor(range: RangeKey): string | undefined {
  const now = Date.now();
  const days = range === "24h" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : null;
  if (days === null) return undefined;
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
}

const EVENT_LABEL: Record<string, string> = {
  sent: "Zugestellt",
  rejected: "Fehlgeschlagen",
  bounced: "Rückläufer",
  complained: "Beschwerde",
  unsubscribed: "Abgemeldet",
  suppressed: "Blockiert",
  rate_limited: "Verzögert (Limit)",
};

const EVENT_CLASS: Record<string, string> = {
  sent: "bg-green-600 text-white border-transparent",
  rejected: "bg-red-600 text-white border-transparent",
  bounced: "bg-orange-500 text-white border-transparent",
  complained: "bg-red-700 text-white border-transparent",
  unsubscribed: "bg-slate-500 text-white border-transparent",
  suppressed: "bg-yellow-400 text-black border-transparent",
  rate_limited: "bg-blue-600 text-white border-transparent",
};

type EventFilter = "all" | "sent" | "failed" | "bounced";
type RecipientFilter = "all" | "admin" | "external";

function Page() {
  const load = useServerFn(listDeliveryEvents);
  const [range, setRange] = useState<RangeKey>("7d");
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>("all");
  const [search, setSearch] = useState("");
  const [events, setEvents] = useState<DeliveryEvent[]>([]);
  const [historyStartsAt, setHistoryStartsAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const since = sinceFor(range);
      const res = await load({ data: { ...(since ? { since } : {}), limit: 100 } });
      setEvents(res.events || []);
      setHistoryStartsAt(res.historyStartsAt);
      setError(res.error);
    } catch (e: any) {
      setError(e?.message || "Zustellereignisse konnten nicht geladen werden.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [load, range]);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter(e => {
      const isAdmin = (e.recipient || "").toLowerCase() === ADMIN_EMAIL;
      if (recipientFilter === "admin" && !isAdmin) return false;
      if (recipientFilter === "external" && isAdmin) return false;
      if (eventFilter === "sent" && e.event_type !== "sent") return false;
      if (eventFilter === "failed" && !["rejected", "suppressed", "rate_limited"].includes(e.event_type)) return false;
      if (eventFilter === "bounced" && !["bounced", "complained"].includes(e.event_type)) return false;
      if (q && !(e.recipient || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, eventFilter, recipientFilter, search]);

  const counts = useMemo(() => {
    const base = { sent: 0, failed: 0, bounced: 0 };
    for (const e of events) {
      const isAdmin = (e.recipient || "").toLowerCase() === ADMIN_EMAIL;
      if (recipientFilter === "admin" && !isAdmin) continue;
      if (recipientFilter === "external" && isAdmin) continue;
      if (e.event_type === "sent") base.sent++;
      else if (["rejected", "suppressed", "rate_limited"].includes(e.event_type)) base.failed++;
      else if (["bounced", "complained"].includes(e.event_type)) base.bounced++;
    }
    return base;
  }, [events, recipientFilter]);

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-primary-deep">Versandstatus</h1>
        <div className="flex gap-2 items-center">
        <TestSendDialog onDone={() => void refresh()} />
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Aktualisieren
        </Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="border-0 shadow-soft"><CardContent className="py-4">
          <div className="text-xs text-muted-foreground">Zugestellt</div>
          <div className="text-2xl font-bold text-green-700">{counts.sent}</div>
        </CardContent></Card>
        <Card className="border-0 shadow-soft"><CardContent className="py-4">
          <div className="text-xs text-muted-foreground">Fehlgeschlagen / blockiert</div>
          <div className="text-2xl font-bold text-red-700">{counts.failed}</div>
        </CardContent></Card>
        <Card className="border-0 shadow-soft"><CardContent className="py-4">
          <div className="text-xs text-muted-foreground">Rückläufer / Beschwerden</div>
          <div className="text-2xl font-bold text-orange-600">{counts.bounced}</div>
        </CardContent></Card>
      </div>

      <Card className="border-0 shadow-soft mb-4">
        <CardContent className="grid gap-4 py-4 md:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Zeitraum</Label>
            <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(RANGE_LABEL) as RangeKey[]).map(k => (
                  <SelectItem key={k} value={k}>{RANGE_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Empfänger-Typ</Label>
            <Select value={recipientFilter} onValueChange={(v) => setRecipientFilter(v as RecipientFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Empfänger</SelectItem>
                <SelectItem value="admin">Vereins-Postfach (intern)</SelectItem>
                <SelectItem value="external">Eltern / Mitglieder</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={eventFilter} onValueChange={(v) => setEventFilter(v as EventFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Ereignisse</SelectItem>
                <SelectItem value="sent">Zugestellt</SelectItem>
                <SelectItem value="failed">Fehlgeschlagen / blockiert</SelectItem>
                <SelectItem value="bounced">Rückläufer / Beschwerden</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">E-Mail-Adresse</Label>
            <Input placeholder="Suche nach Empfänger" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-0 shadow-soft mb-4">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-soft">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Lade Zustellereignisse…</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">Keine Zustellereignisse im gewählten Zeitraum.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zeitpunkt</TableHead>
                  <TableHead>Empfänger</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e, i) => {
                  const isAdmin = (e.recipient || "").toLowerCase() === ADMIN_EMAIL;
                  return (
                    <TableRow key={`${e.message_id || "x"}-${e.timestamp}-${i}`}>
                      <TableCell className="whitespace-nowrap text-xs">{formatDateTimeBerlin(e.timestamp)}</TableCell>
                      <TableCell className="text-sm">{e.recipient}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{isAdmin ? "Intern" : "Eltern / Mitglieder"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={EVENT_CLASS[e.event_type] || ""}>
                          {EVENT_LABEL[e.event_type] || e.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.status || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        Angezeigt werden Zustellereignisse des E-Mail-Versands
        {historyStartsAt ? ` (verfügbar ab ${formatDateTimeBerlin(historyStartsAt)})` : ""}.
        Öffnungs- oder Leseraten werden nicht erfasst. Die Inhalte der gesendeten E-Mails
        findest du unter „Gesendete E-Mails“.
      </p>
    </div>
  );
}
