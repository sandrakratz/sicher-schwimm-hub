// Gemeinsame Admin-Ansicht für Kursanfragen.
// mode="all"      -> vollständige Kursanfragen-Verwaltung
// mode="waiting"  -> nur Anfragen auf der Warteliste (ohne Kurszuweisung)
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RequestDetails } from "@/components/admin/kursanfragen/RequestDialog";
import { RequestTable, type TableKind } from "@/components/admin/kursanfragen/RequestTable";
import type { Sharky } from "@/components/admin/kursanfragen/parts";
import {
  COURSE_GROUPS,
  groupKeyFor,
  isWaitlisted,
  makeCourseLabel,
  type CourseInfo,
  type CourseOpt,
  type Item,
} from "@/components/admin/kursanfragen/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

const TABS: { value: Exclude<TableKind, "waiting">; label: string }[] = [
  { value: "open", label: "Aktuelle Anfragen" },
  { value: "assigned", label: "Zugewiesene Anfragen" },
  { value: "rejected", label: "Abgelehnt" },
];

export function CourseRequestsAdmin({
  mode = "all",
  openId,
}: {
  mode?: "all" | "waiting";
  /** Anfrage, die nach dem Laden direkt geöffnet wird (Link aus dem Eingang der Anfrageliste). */
  openId?: string;
}) {
  const [rows, setRows] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [allCourses, setAllCourses] = useState<CourseInfo[]>([]);
  const [sharkyBusyId, setSharkyBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data }, { data: cs }, { data: progs }, { data: allCs }] = await Promise.all([
      supabase.from("course_requests").select("*").order("created_at", { ascending: false }),
      supabase
        .from("courses")
        .select(
          "id,name,status,max_participants,starts_on,price_member,price_non_member,program_id",
        )
        .is("archived_at", null)
        .order("starts_on", { ascending: true, nullsFirst: false }),
      supabase.from("course_programs").select("id,sort_order"),
      supabase.from("courses").select("id,name,starts_on,ends_on"),
    ]);
    const items = (data as Item[]) || [];
    setRows(items);
    const hit = openId ? items.find((r) => r.id === openId) : undefined;
    if (hit) setSelected((s) => s ?? hit);
    const rank = new Map((progs ?? []).map((p) => [p.id, p.sort_order]));
    // Nach Angebot (leicht → schwer, interne am Ende); innerhalb eines Angebots bleibt die Terminfolge.
    const sorted = [...((cs as CourseOpt[]) || [])].sort(
      (a, b) =>
        (rank.get(a.program_id ?? "") ?? Infinity) - (rank.get(b.program_id ?? "") ?? Infinity),
    );
    setCourses(sorted);
    setAllCourses((allCs as CourseInfo[]) || []);
  }, [openId]);
  useEffect(() => {
    void load();
  }, [load]);

  /** Geänderte Felder in Liste und geöffnetem Dialog übernehmen. */
  function patchItem(id: string, patch: Partial<Item>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSelected((s) => (s && s.id === id ? { ...s, ...patch } : s));
  }

  const sharky: Sharky = {
    busyId: sharkyBusyId,
    async toggle(item) {
      const next = !item.referred_sharky;
      setSharkyBusyId(item.id);
      const patch = {
        referred_sharky: next,
        referred_sharky_at: next ? new Date().toISOString() : null,
      };
      const { error } = await supabase.from("course_requests").update(patch).eq("id", item.id);
      setSharkyBusyId(null);
      if (error) return toast.error(error.message);
      patchItem(item.id, patch);
      toast.success(next ? "Als an Sharky verwiesen markiert" : "Markierung entfernt");
    },
  };

  const courseLabel = makeCourseLabel(allCourses);
  const isWaiting = mode === "waiting";

  // Warteliste: älteste zuerst (entspricht der Reihenfolge auf der Warteliste). In der
  // Kursanfragen-Übersicht fehlen Wartelisten-Einträge, da sie einen eigenen Menüpunkt haben.
  const visibleRows = isWaiting
    ? rows.filter(isWaitlisted).sort((a, b) => a.created_at.localeCompare(b.created_at))
    : rows.filter((r) => !isWaitlisted(r));

  const grouped = COURSE_GROUPS.map((g) => {
    const items = visibleRows.filter((r) => groupKeyFor(r.desired_course) === g.key);
    const rest = items.filter((r) => r.status !== "rejected");
    const byTab: Record<Exclude<TableKind, "waiting">, Item[]> = {
      open: rest.filter((r) => !r.assigned_course_id),
      assigned: rest.filter((r) => !!r.assigned_course_id),
      rejected: items.filter((r) => r.status === "rejected"),
    };
    return { ...g, items, ...byTab };
  }).filter((g) => g.items.length > 0);

  const table = (items: Item[], kind: TableKind) => (
    <RequestTable
      items={items}
      kind={kind}
      onOpen={setSelected}
      courseLabel={courseLabel}
      sharky={sharky}
    />
  );

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold text-primary-deep">
          {isWaiting ? "Warteliste" : "Kursanfragen"}
        </h1>
        {isWaiting && <Badge variant="secondary">{visibleRows.length} auf der Warteliste</Badge>}
      </div>
      {visibleRows.length === 0 ? (
        <Card className="border-0 shadow-soft">
          <CardContent className="text-center text-muted-foreground py-10">
            {isWaiting ? "Aktuell steht niemand auf der Warteliste." : "Noch keine Anfragen."}
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={grouped.map((g) => g.key)} className="space-y-3">
          {grouped.map((g) => (
            <AccordionItem key={g.key} value={g.key} className="border-0">
              <Card className="border-0 shadow-soft">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="font-display text-lg font-semibold text-primary-deep">
                      {g.label}
                    </span>
                    {isWaiting ? (
                      <Badge variant="secondary">{g.items.length} wartend</Badge>
                    ) : (
                      <>
                        <Badge variant="secondary">{g.open.length} offen</Badge>
                        <Badge variant="outline">{g.assigned.length} zugewiesen</Badge>
                        {g.rejected.length > 0 && (
                          <Badge variant="destructive">{g.rejected.length} abgelehnt</Badge>
                        )}
                      </>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="p-0">
                    {isWaiting ? (
                      table(g.items, "waiting")
                    ) : (
                      <Tabs defaultValue="open">
                        <div className="px-4 pb-2">
                          <TabsList>
                            {TABS.map((t) => (
                              <TabsTrigger key={t.value} value={t.value}>
                                {t.label} ({g[t.value].length})
                              </TabsTrigger>
                            ))}
                          </TabsList>
                        </div>
                        {TABS.map((t) => (
                          <TabsContent key={t.value} value={t.value}>
                            {table(g[t.value], t.value)}
                          </TabsContent>
                        ))}
                      </Tabs>
                    )}
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kursanfrage</DialogTitle>
          </DialogHeader>
          {selected && (
            <RequestDetails
              key={selected.id}
              item={selected}
              courses={courses}
              courseLabel={courseLabel}
              sharky={sharky}
              actions={{
                patch: (p) => patchItem(selected.id, p),
                reload: load,
                close: () => setSelected(null),
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
