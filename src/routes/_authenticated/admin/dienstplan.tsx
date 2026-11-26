import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarCheck, RefreshCw, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loadPlanningData } from "@/lib/dienstplan.functions";
import { getMyAdminRoles } from "@/lib/role-guard";
import { addDays, gapOf, indexPlan, openAttendanceCount, type PlanData } from "@/lib/dienstplan";
import { todayBerlinIso } from "@/lib/format";
import { GapList } from "@/components/admin/dienstplan/GapList";
import { ReplacementDialog } from "@/components/admin/dienstplan/ReplacementDialog";
import { WithdrawalDialog } from "@/components/admin/dienstplan/WithdrawalDialog";
import { WeekPlan } from "@/components/admin/dienstplan/WeekPlan";
import { CoursePlan } from "@/components/admin/dienstplan/CoursePlan";
import { AutoPlan } from "@/components/admin/dienstplan/AutoPlan";
import { AttendanceConfirm } from "@/components/admin/dienstplan/AttendanceConfirm";
import { PlanLog } from "@/components/admin/dienstplan/PlanLog";
import { CalendarAssign } from "@/components/admin/dienstplan/CalendarAssign";

const TABS = [
  "luecken",
  "woche",
  "kurse",
  "einteilen",
  "anwesenheit",
  "vorschlag",
  "verein",
  "protokoll",
] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/admin/dienstplan")({
  // ?tab=einteilen&kurs=<id> öffnet die Einteilung eines Kurses (z. B. aus der Kursseite)
  validateSearch: (search: Record<string, unknown>): { tab?: Tab; kurs?: string } => ({
    ...(TABS.includes(search["tab"] as Tab) ? { tab: search["tab"] as Tab } : {}),
    ...(typeof search["kurs"] === "string" && search["kurs"] ? { kurs: search["kurs"] } : {}),
  }),
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board"] } });
    } catch {
      throw redirect({ to: "/admin/benutzer" });
    }
  },
  head: () => ({
    meta: [{ title: "Dienstplan – Verwaltung" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: Page,
});

function Page() {
  const load = useServerFn(loadPlanningData);
  const [data, setData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const search = Route.useSearch();
  const [tab, setTab] = useState<string>(search.tab ?? "luecken");
  const [pickId, setPickId] = useState<string | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [logKey, setLogKey] = useState(0);
  // Protokoll nur für den Administrator (Server prüft das ebenfalls)
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    getMyAdminRoles()
      .then((r) => setIsAdmin(r.roles.includes("admin")))
      .catch(() => setIsAdmin(false));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await load({ data: {} }));
      setLogKey((k) => k + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Dienstplan konnte nicht geladen werden";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openGaps = useMemo(() => {
    if (!data) return 0;
    const ix = indexPlan(data);
    const today = todayBerlinIso();
    // Gleicher Zeitraum wie die Lückenliste beim Öffnen (6 Wochen), sonst widersprechen sich Zahl und Liste
    const limit = addDays(today, 42);
    return data.sessions.filter((s) => s.date >= today && s.date <= limit && gapOf(ix, s) > 0)
      .length;
  }, [data]);

  /** Vergangene Einsätze mit offener Anwesenheit (Bestätigung fehlt oder kein Eintrag). */
  const openAtt = useMemo(
    () => (data ? openAttendanceCount(data, indexPlan(data), todayBerlinIso()) : 0),
    [data],
  );

  const picked = data?.sessions.find((s) => s.id === pickId) ?? null;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold text-primary-deep">
            <UsersRound className="h-6 w-6" /> Dienstplan
          </h1>
          <p className="text-sm text-muted-foreground">
            Alles zur Einteilung an einem Ort: Wo fehlt jemand, wer kann einspringen, wer ist wann
            eingeteilt – und unter „Kurs einteilen“ alle Termine eines Kurses auf einmal. Wer für
            welchen Termin zugesagt hat, siehst du im Wochenplan und unter „Nach Kursen“; die
            Verfügbarkeit trägt jede Trainer:in selbst ein.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/trainer/verfuegbarkeit">
              <CalendarCheck className="h-4 w-4" /> Eigene Verfügbarkeit eintragen
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Aktualisieren
          </Button>
        </div>
      </div>

      {error && !data && <div className="text-sm text-destructive">{error}</div>}
      {!data && !error && <div className="text-sm text-muted-foreground">Wird geladen…</div>}

      {data && (
        <Tabs
          value={tab}
          onValueChange={(next) => {
            // Nach dem Einteilen eines ganzen Kurses Lücken und Wochenplan neu laden
            if (tab === "einteilen") void refresh();
            setTab(next);
          }}
        >
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="luecken">Lücken{openGaps > 0 ? ` (${openGaps})` : ""}</TabsTrigger>
            <TabsTrigger value="woche">Wochenplan{openAtt > 0 ? ` (${openAtt})` : ""}</TabsTrigger>
            <TabsTrigger value="kurse">Nach Kursen{openAtt > 0 ? ` (${openAtt})` : ""}</TabsTrigger>
            <TabsTrigger value="einteilen">Kurs einteilen</TabsTrigger>
            <TabsTrigger value="anwesenheit">Anwesenheit</TabsTrigger>
            <TabsTrigger value="vorschlag">Vorschlag</TabsTrigger>
            <TabsTrigger value="verein">Vereinstermine &amp; Helfer</TabsTrigger>
            {isAdmin && <TabsTrigger value="protokoll">Protokoll</TabsTrigger>}
          </TabsList>

          <TabsContent value="luecken" className="mt-4">
            <GapList data={data} onPick={setPickId} onWithdrawal={() => setWithdrawOpen(true)} />
          </TabsContent>
          <TabsContent value="woche" className="mt-4">
            <WeekPlan data={data} onChanged={() => void refresh()} />
          </TabsContent>
          <TabsContent value="kurse" className="mt-4">
            <CoursePlan data={data} onPick={setPickId} onChanged={() => void refresh()} />
          </TabsContent>
          <TabsContent value="einteilen" className="mt-4">
            <CalendarAssign view="kurse" initialCourseId={search.kurs} />
          </TabsContent>
          <TabsContent value="anwesenheit" className="mt-4">
            <AttendanceConfirm />
          </TabsContent>
          <TabsContent value="verein" className="mt-4">
            <CalendarAssign view="verein" />
          </TabsContent>
          <TabsContent value="vorschlag" className="mt-4">
            <AutoPlan data={data} onChanged={() => void refresh()} />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="protokoll" className="mt-4">
              <PlanLog reloadKey={logKey} />
            </TabsContent>
          )}

          <ReplacementDialog
            session={picked}
            data={data}
            onClose={() => setPickId(null)}
            onChanged={() => void refresh()}
          />
          <WithdrawalDialog
            open={withdrawOpen}
            data={data}
            onClose={() => setWithdrawOpen(false)}
            onDone={async (firstGap) => {
              setWithdrawOpen(false);
              await refresh();
              setTab("luecken");
              if (firstGap) setPickId(firstGap);
            }}
          />
        </Tabs>
      )}
    </div>
  );
}
