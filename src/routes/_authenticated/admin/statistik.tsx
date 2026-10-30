import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  CURRENT_VERSIONS,
  getAnalyticsDashboard,
  type DashboardData,
} from "@/lib/analytics-dashboard.functions";
import { MIN_VISITORS_PER_VARIANT } from "@/lib/analytics/stats";
import { formatDateTimeBerlin } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/statistik")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board"] } });
    } catch {
      throw redirect({ to: "/admin/benutzer" });
    }
  },
  component: Page,
});

const RANGES = [
  { days: 7, label: "Letzte 7 Tage" },
  { days: 30, label: "Letzte 30 Tage" },
  { days: 90, label: "Letzte 90 Tage" },
];

const FORM_LABEL: Record<string, string> = {
  kontakt: "Kontakt",
  warteliste: "Warteliste",
  widerruf: "Widerruf",
  mitgliedschaft: "Mitgliedschaft",
  kursbuchung_kind: "Kursbuchung (Kinder)",
  kursbuchung_erwachsene: "Kursbuchung (Erwachsene)",
  erwachsenen_interesse: "Erwachsenenkurs: Interesse",
};

const REASON_LABEL: Record<string, string> = {
  gesperrt: "Sperrliste",
  doppelt: "Doppelter Eintrag",
  abgelehnt: "Abgelehnt",
  fehler: "Fehler beim Verarbeiten",
  honeypot: "Spam-Schutz",
  zu_viele: "Zu viele Anfragen",
  ungueltig: "Ungültige Eingabe",
};

const nf = new Intl.NumberFormat("de-DE");
const num = (n: number | null | undefined) => (n == null ? "–" : nf.format(n));
const pct = (n: number | null | undefined, digits = 0) =>
  n == null || !Number.isFinite(n) ? "–" : `${(n * 100).toFixed(digits).replace(".", ",")} %`;
const seconds = (n: number | null | undefined) =>
  n == null ? "–" : `${nf.format(Math.round(n))} s`;
const formLabel = (f: string) => FORM_LABEL[f] ?? f;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 font-display text-3xl font-bold text-primary-deep">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

const chartConfig = {
  views: { label: "Seitenaufrufe", color: "hsl(var(--primary))" },
  visitors: { label: "Besucher", color: "hsl(var(--accent))" },
} satisfies ChartConfig;

function Page() {
  const load = useServerFn(getAnalyticsDashboard);
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await load({ data: { days } }));
    } catch (e) {
      console.error(e);
      setError(
        "Die Statistik konnte nicht geladen werden. Ist die Migration 20261030110000 eingespielt?",
      );
    } finally {
      setLoading(false);
    }
  }, [load, days]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Anteil der Eingänge, die auch im Browser gemessen wurden = ungefähre Zustimmungsquote
  const measured = data
    ? data.forms.reduce((s, f) => s + f.client_success, 0) /
      Math.max(
        1,
        data.forms.reduce((s, f) => s + f.server_received, 0) +
          data.db_counts.kontakt +
          data.db_counts.mitgliedschaft,
      )
    : null;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary-deep">Statistik</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Nutzung der öffentlichen Seiten. Browserdaten stammen nur von Besuchern, die der Messung
            zugestimmt haben. Die Server-Zahlen zählen alle Eingänge.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-44" aria-label="Zeitraum">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.days} value={String(r.days)}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void refresh()}
            aria-label="Neu laden"
          >
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {data && (
        <Tabs defaultValue="uebersicht" className="space-y-4">
          <TabsList>
            <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
            <TabsTrigger value="seiten">Seiten</TabsTrigger>
            <TabsTrigger value="formulare">Formulare</TabsTrigger>
            <TabsTrigger value="tests">A/B-Tests</TabsTrigger>
            <TabsTrigger value="daten">Daten & Versionen</TabsTrigger>
          </TabsList>

          <TabsContent value="uebersicht" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Besucher (gemessen)" value={num(data.overview.visitors)} />
              <Stat label="Seitenaufrufe" value={num(data.overview.page_views)} />
              <Stat
                label="Mittlere Verweildauer"
                value={seconds(data.overview.median_visible_s)}
                hint="Median, nur sichtbare Zeit"
              />
              <Stat
                label="Messquote"
                value={pct(measured)}
                hint="Anteil der Formular-Eingänge, die auch im Browser gemessen wurden (ca. Zustimmungsquote)"
              />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Verlauf</CardTitle>
              </CardHeader>
              <CardContent>
                {data.daily.length === 0 ? (
                  <Empty>Noch keine Messdaten im Zeitraum.</Empty>
                ) : (
                  <ChartContainer config={chartConfig} className="h-64 w-full aspect-auto">
                    <LineChart data={data.daily}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="day"
                        tickFormatter={(d: string) => d.slice(8, 10) + "." + d.slice(5, 7) + "."}
                      />
                      <YAxis allowDecimals={false} width={32} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        dataKey="views"
                        stroke="var(--color-views)"
                        dot={false}
                        strokeWidth={2}
                      />
                      <Line
                        dataKey="visitors"
                        stroke="var(--color-visitors)"
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Herkunft</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.referrers.length === 0 ? (
                    <Empty>Keine Verweise von anderen Seiten.</Empty>
                  ) : (
                    <Table>
                      <TableBody>
                        {data.referrers.map((r) => (
                          <TableRow key={r.host}>
                            <TableCell>{r.host}</TableCell>
                            <TableCell className="text-right">{num(r.sessions)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Geräte</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.devices.length === 0 ? (
                    <Empty>Keine Daten.</Empty>
                  ) : (
                    <Table>
                      <TableBody>
                        {data.devices.map((d) => (
                          <TableRow key={d.device}>
                            <TableCell>
                              {{ mobile: "Handy", tablet: "Tablet", desktop: "PC" }[d.device] ??
                                d.device}
                            </TableCell>
                            <TableCell className="text-right">{num(d.visitors)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Klicks auf Schaltflächen</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.cta.length === 0 ? (
                    <Empty>Keine Klicks erfasst.</Empty>
                  ) : (
                    <Table>
                      <TableBody>
                        {data.cta.map((c) => (
                          <TableRow key={c.cta}>
                            <TableCell>{c.cta}</TableCell>
                            <TableCell className="text-right">{num(c.clicks)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="seiten">
            <Card>
              <CardContent className="pt-6">
                {data.pages.length === 0 ? (
                  <Empty>Noch keine Messdaten im Zeitraum.</Empty>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Seite</TableHead>
                        <TableHead className="text-right">Aufrufe</TableHead>
                        <TableHead className="text-right">Besucher</TableHead>
                        <TableHead className="text-right">Verweildauer (Median)</TableHead>
                        <TableHead className="text-right">Ø Scrolltiefe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.pages.map((p) => (
                        <TableRow key={p.path}>
                          <TableCell className="font-mono text-xs">{p.path}</TableCell>
                          <TableCell className="text-right">{num(p.views)}</TableCell>
                          <TableCell className="text-right">{num(p.visitors)}</TableCell>
                          <TableCell className="text-right">
                            {seconds(p.median_visible_s)}
                          </TableCell>
                          <TableCell className="text-right">
                            {p.avg_scroll_pct == null ? "–" : `${p.avg_scroll_pct} %`}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="formulare" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Trichter und Abgleich Browser ↔ Server</CardTitle>
              </CardHeader>
              <CardContent>
                {data.forms.length === 0 ? (
                  <Empty>Noch keine Formular-Daten im Zeitraum.</Empty>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Formular</TableHead>
                        <TableHead className="text-right">Begonnen</TableHead>
                        <TableHead className="text-right">Versuche</TableHead>
                        <TableHead className="text-right">davon fehlerhaft</TableHead>
                        <TableHead className="text-right">Abgebrochen</TableHead>
                        <TableHead className="text-right">Erfolg (Browser)</TableHead>
                        <TableHead className="text-right">Eingang (Server)</TableHead>
                        <TableHead className="text-right">Abgewiesen</TableHead>
                        <TableHead className="text-right">Messquote</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.forms.map((f) => {
                        // Kontakt und Mitgliedschaft schreiben direkt in die Datenbank: dort wird gezählt
                        const direct =
                          f.form === "kontakt"
                            ? data.db_counts.kontakt
                            : f.form === "mitgliedschaft"
                              ? data.db_counts.mitgliedschaft
                              : null;
                        const received = direct ?? f.server_received;
                        return (
                          <TableRow key={f.form}>
                            <TableCell className="font-medium">{formLabel(f.form)}</TableCell>
                            <TableCell className="text-right">{num(f.started)}</TableCell>
                            <TableCell className="text-right">{num(f.attempts)}</TableCell>
                            <TableCell className="text-right">
                              {f.attempts > 0 ? (
                                <span title="Anteil der Versuche mit Eingabefehlern">
                                  {num(f.invalid_attempts)} ({pct(f.invalid_attempts / f.attempts)})
                                </span>
                              ) : (
                                "–"
                              )}
                            </TableCell>
                            <TableCell className="text-right">{num(f.abandoned)}</TableCell>
                            <TableCell className="text-right">{num(f.client_success)}</TableCell>
                            <TableCell className="text-right">{num(received)}</TableCell>
                            <TableCell className="text-right">{num(f.server_rejected)}</TableCell>
                            <TableCell className="text-right">
                              {received > 0 ? pct(f.client_success / received) : "–"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  „Messquote“ = Erfolge im Browser ÷ Eingänge im Server. Sie liegt unter 100 %, weil
                  nur zustimmende Besucher gemessen werden. Fällt sie bei einem Formular deutlich
                  unter den anderen, fehlt dort vermutlich die Messung. Kontakt und Mitgliedschaft
                  zählen die Eingänge direkt in der Datenbank.
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Häufigste Fehlerfelder</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.field_errors.length === 0 ? (
                    <Empty>Keine Eingabefehler erfasst.</Empty>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Formular</TableHead>
                          <TableHead>Feld</TableHead>
                          <TableHead>Art</TableHead>
                          <TableHead className="text-right">Anzahl</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.field_errors.map((e) => (
                          <TableRow key={`${e.form}-${e.field}-${e.code}`}>
                            <TableCell>{formLabel(e.form)}</TableCell>
                            <TableCell className="font-mono text-xs">{e.field}</TableCell>
                            <TableCell>{e.code}</TableCell>
                            <TableCell className="text-right">{num(e.errors)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Hier brechen Besucher ab</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.abandon_fields.length === 0 ? (
                      <Empty>Keine Abbrüche erfasst.</Empty>
                    ) : (
                      <Table>
                        <TableBody>
                          {data.abandon_fields.map((a) => (
                            <TableRow key={`${a.form}-${a.last_field}`}>
                              <TableCell>{formLabel(a.form)}</TableCell>
                              <TableCell className="font-mono text-xs">{a.last_field}</TableCell>
                              <TableCell className="text-right">{num(a.n)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Zuletzt angeklicktes Feld vor dem Verlassen der Seite.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Vom Server abgewiesen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.rejections.length === 0 ? (
                      <Empty>Nichts abgewiesen.</Empty>
                    ) : (
                      <Table>
                        <TableBody>
                          {data.rejections.map((r) => (
                            <TableRow key={`${r.form}-${r.reason}`}>
                              <TableCell>{formLabel(r.form)}</TableCell>
                              <TableCell>{REASON_LABEL[r.reason] ?? r.reason}</TableCell>
                              <TableCell className="text-right">{num(r.n)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tests" className="space-y-4">
            {data.experiments.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <Empty>Noch kein A/B-Test gestartet.</Empty>
                </CardContent>
              </Card>
            ) : (
              data.experiments.map((e) => {
                const best = e.analysis.variants
                  .filter((v) => v.pValue !== null && v.pValue < 0.05)
                  .sort((a, b) => b.rate - a.rate)[0];
                return (
                  <Card key={`${e.key}-${e.version}`}>
                    <CardHeader>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-lg">
                          {e.key}{" "}
                          <span className="text-muted-foreground">· Version {e.version}</span>
                        </CardTitle>
                        <Badge variant={e.status === "running" ? "default" : "secondary"}>
                          {e.status === "running" ? "läuft" : "beendet"}
                        </Badge>
                      </div>
                      {e.description && (
                        <p className="text-sm text-muted-foreground">{e.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Ziel: {e.goal_event}
                        {Object.keys(e.goal_filter ?? {}).length > 0 &&
                          ` ${JSON.stringify(e.goal_filter)}`}
                        {" · "}
                        {e.started_at ? formatDateTimeBerlin(e.started_at) : "nicht gestartet"}
                        {e.ended_at && ` bis ${formatDateTimeBerlin(e.ended_at)}`}
                        {" · gilt nur für diese Version"}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Variante</TableHead>
                            <TableHead className="text-right">Besucher</TableHead>
                            <TableHead className="text-right">Erfolge</TableHead>
                            <TableHead className="text-right">Rate</TableHead>
                            <TableHead className="text-right">Unterschied</TableHead>
                            <TableHead className="text-right">p-Wert</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {e.analysis.variants.map((v) => (
                            <TableRow key={v.variant}>
                              <TableCell>
                                {v.variant}
                                {v.variant === e.analysis.baseline && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    (Basis)
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">{num(v.visitors)}</TableCell>
                              <TableCell className="text-right">{num(v.conversions)}</TableCell>
                              <TableCell className="text-right">{pct(v.rate, 1)}</TableCell>
                              <TableCell className="text-right">
                                {v.diffPoints == null
                                  ? "–"
                                  : `${v.diffPoints > 0 ? "+" : ""}${v.diffPoints.toFixed(1).replace(".", ",")} Pkt.`}
                              </TableCell>
                              <TableCell className="text-right">
                                {v.pValue == null ? "–" : v.pValue.toFixed(3).replace(".", ",")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <p className="text-sm">
                        {!e.analysis.enoughData
                          ? `Noch zu wenig Daten: mindestens ${MIN_VISITORS_PER_VARIANT} Besucher je Variante, sonst ist jedes Ergebnis Zufall.`
                          : best
                            ? `Variante „${best.variant}“ ist signifikant besser als die Basis (p < 0,05).`
                            : "Kein belegbarer Unterschied zwischen den Varianten."}
                      </p>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="daten">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ereignisse nach Schema-Version</CardTitle>
                <p className="text-sm text-muted-foreground">
                  In die Kennzahlen fließt nur die aktuelle Version jedes Ereignisses ein. Ältere
                  Versionen bleiben sichtbar, werden aber nicht eingerechnet.
                </p>
              </CardHeader>
              <CardContent>
                {data.versions.length === 0 ? (
                  <Empty>Noch keine Ereignisse im Zeitraum.</Empty>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ereignis</TableHead>
                        <TableHead>Quelle</TableHead>
                        <TableHead className="text-right">Version</TableHead>
                        <TableHead className="text-right">Anzahl</TableHead>
                        <TableHead>Zuerst</TableHead>
                        <TableHead>Zuletzt</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.versions.map((v) => {
                        const current = CURRENT_VERSIONS[v.event] === v.schema_version;
                        return (
                          <TableRow key={`${v.event}-${v.source}-${v.schema_version}`}>
                            <TableCell className="font-mono text-xs">{v.event}</TableCell>
                            <TableCell>{v.source === "client" ? "Browser" : "Server"}</TableCell>
                            <TableCell className="text-right">{v.schema_version}</TableCell>
                            <TableCell className="text-right">{num(v.events)}</TableCell>
                            <TableCell>{formatDateTimeBerlin(v.first_seen)}</TableCell>
                            <TableCell>{formatDateTimeBerlin(v.last_seen)}</TableCell>
                            <TableCell>
                              <Badge variant={current ? "default" : "secondary"}>
                                {current ? "eingerechnet" : "nicht eingerechnet"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  Einzelereignisse werden nach 90 Tagen gelöscht. Danach bleiben nur Tageszahlen
                  (Tabelle analytics_daily).
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
