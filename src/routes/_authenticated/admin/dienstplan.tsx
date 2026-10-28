import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loadPlanningData } from "@/lib/dienstplan.functions";
import { gapOf, indexPlan, type PlanData } from "@/lib/dienstplan";
import { todayBerlinIso } from "@/lib/format";
import { GapList } from "@/components/admin/dienstplan/GapList";
import { ReplacementDialog } from "@/components/admin/dienstplan/ReplacementDialog";
import { WithdrawalDialog } from "@/components/admin/dienstplan/WithdrawalDialog";
import { WeekPlan } from "@/components/admin/dienstplan/WeekPlan";
import { AutoPlan } from "@/components/admin/dienstplan/AutoPlan";
import { PlanLog } from "@/components/admin/dienstplan/PlanLog";

export const Route = createFileRoute("/_authenticated/admin/dienstplan")({
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
  const [tab, setTab] = useState("luecken");
  const [pickId, setPickId] = useState<string | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [logKey, setLogKey] = useState(0);

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
    return data.sessions.filter((s) => s.date >= today && gapOf(ix, s) > 0).length;
  }, [data]);

  const picked = data?.sessions.find((s) => s.id === pickId) ?? null;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <UsersRound className="h-6 w-6" /> Dienstplan
          </h1>
          <p className="text-sm text-muted-foreground">
            Wo fehlt jemand, wer kann einspringen, wer ist wann eingeteilt? Einzelne Kurse
            bearbeitest du unter „Kurse & Termine“.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Aktualisieren
        </Button>
      </div>

      {error && !data && <div className="text-sm text-destructive">{error}</div>}
      {!data && !error && <div className="text-sm text-muted-foreground">Wird geladen…</div>}

      {data && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="luecken">Lücken{openGaps > 0 ? ` (${openGaps})` : ""}</TabsTrigger>
            <TabsTrigger value="woche">Wochenplan</TabsTrigger>
            <TabsTrigger value="vorschlag">Vorschlag</TabsTrigger>
            <TabsTrigger value="protokoll">Protokoll</TabsTrigger>
          </TabsList>

          <TabsContent value="luecken" className="mt-4">
            <GapList data={data} onPick={setPickId} onWithdrawal={() => setWithdrawOpen(true)} />
          </TabsContent>
          <TabsContent value="woche" className="mt-4">
            <WeekPlan data={data} />
          </TabsContent>
          <TabsContent value="vorschlag" className="mt-4">
            <AutoPlan data={data} onChanged={() => void refresh()} />
          </TabsContent>
          <TabsContent value="protokoll" className="mt-4">
            <PlanLog reloadKey={logKey} />
          </TabsContent>

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
