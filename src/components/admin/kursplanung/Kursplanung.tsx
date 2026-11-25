import { CalendarPlus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { POOLS } from "@/lib/pool-schedule";
import { BadplanTab } from "./BadplanTab";
import { usePlanUpload } from "./usePlanUpload";
import { TerminplanTab } from "./TerminplanTab";
import { usePlanning, type Planning } from "./usePlanning";
import { usePoolData } from "./usePoolData";
import { VorschlagTab } from "./VorschlagTab";

/** Wie viele Trainer grundsätzlich bereit sind, die jeweilige Kursart zu betreuen. */
function TrainerReadiness({ plan }: { plan: Planning }) {
  const { team, prefRows } = plan.data;
  if (!plan.kinds.length || !team.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
      <span className="font-medium">Trainer je Kursart:</span>
      {plan.kinds.map((k) => {
        const mine = prefRows.filter((r) => r.programId === k.id);
        const out = new Set(mine.filter((r) => r.pref === "nein").map((r) => r.trainerId));
        const gern = mine.filter((r) => r.pref === "gern").length;
        const ready = team.filter((t) => !out.has(t.id)).length;
        return (
          <Badge
            key={k.id}
            variant="outline"
            className={ready < k.trainers ? "border-destructive text-destructive" : ""}
            title={`${ready} von ${team.length} Trainern betreuen diese Kursart (${out.size} nicht, ${gern} gern). Benötigt je Termin: ${k.trainers}.`}
          >
            {plan.programName(k.id)}: {ready}
            {gern > 0 ? ` (${gern} gern)` : ""} · braucht {k.trainers}
          </Badge>
        );
      })}
    </div>
  );
}

/** Kursplanung: Badtermine mit bereits belegten Kursen, Vorschlag neuer Zeiträume, Badplan-Upload. */
export function Kursplanung() {
  const [pool, setPool] = useState(POOLS[0].id);
  const cfg = POOLS.find((p) => p.id === pool)!;
  const [tab, setTab] = useState("plan");

  const data = usePoolData(cfg);
  const plan = usePlanning(cfg, data);
  const upload = usePlanUpload(plan, (conflicts) => setTab(conflicts ? "badplan" : "plan"));
  const { terms, chosen } = plan;

  function switchPool(id: string) {
    setPool(id);
    upload.reset();
    plan.resetChoices({ adjustments: true });
  }

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold text-primary-deep">
            <CalendarPlus className="h-6 w-6" /> Kursplanung
          </h1>
          <p className="text-sm text-muted-foreground">
            Welche Badtermine gibt es, was läuft dort schon, und welche neuen Kurszeiträume passen
            hinein?
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            {POOLS.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant={p.id === pool ? "default" : "outline"}
                onClick={() => switchPool(p.id)}
              >
                {p.name} · {p.dayName}s
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" disabled={data.loading} onClick={data.reloadAll}>
            <RefreshCw className={`h-4 w-4 ${data.loading ? "animate-spin" : ""}`} /> Aktualisieren
          </Button>
        </div>
      </div>

      <TrainerReadiness plan={plan} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="plan">Terminplan</TabsTrigger>
          <TabsTrigger value="vorschlag">
            Vorschlag{terms.length ? ` (${chosen.length}/${terms.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="badplan">
            Badplan{upload.conflicts.length ? ` (${upload.conflicts.length} betroffen)` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="mt-4 space-y-3">
          <TerminplanTab plan={plan} onUpload={() => setTab("badplan")} />
        </TabsContent>

        <TabsContent value="vorschlag" className="mt-4 space-y-5">
          <VorschlagTab plan={plan} />
        </TabsContent>

        <TabsContent value="badplan" className="mt-4 space-y-4">
          <BadplanTab plan={plan} upload={upload} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
