import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { useAssignmentContext } from "@/components/admin/AssignControl";
import {
  ASSIGNMENT_AREAS,
  getDigestSetting,
  setAssignmentRule,
  setDigestSetting,
  type AssignmentArea,
} from "@/lib/assignments.functions";

export const Route = createFileRoute("/_authenticated/admin/zustaendigkeiten")({
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
    meta: [
      { title: "Zuständigkeiten – Verwaltung | Sicher Schwimmen e.V." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const ctx = useAssignmentContext();
  const digest = useQuery({ queryKey: ["digest-setting"], queryFn: () => getDigestSetting() });
  const toggleDigest = useMutation({
    mutationFn: (enabled: boolean) => setDigestSetting({ data: { enabled } }),
    onSuccess: (r) => {
      toast.success(r.enabled ? "Zusammenfassung eingeschaltet" : "Zusammenfassung ausgeschaltet");
      qc.invalidateQueries({ queryKey: ["digest-setting"] });
    },
    onError: (e: Error) => toast.error(e.message || "Speichern fehlgeschlagen"),
  });
  const save = useMutation({
    mutationFn: (v: { area: AssignmentArea; assignee: string | null }) =>
      setAssignmentRule({ data: v }),
    onSuccess: () => {
      toast.success("Standard-Zuständigkeit gespeichert");
      qc.invalidateQueries({ queryKey: ["assignment-context"] });
    },
    onError: (e: Error) => toast.error(e.message || "Speichern fehlgeschlagen"),
  });

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary-deep">Zuständigkeiten</h1>
        <p className="text-sm text-muted-foreground">
          Wer kümmert sich standardmäßig um welchen Bereich? Der Standard gilt für alle Vorgänge,
          die nicht ausdrücklich jemand anderem zugewiesen sind. Er erscheint als „(Regel)“ und im
          Filter „Zuständig“. Einzelne Vorgänge können Sie jederzeit anderen zuweisen oder mit einer
          Notiz weitergeben.
        </p>
      </div>
      <Card className="border-0 shadow-soft">
        <CardContent className="divide-y p-0">
          {(Object.keys(ASSIGNMENT_AREAS) as AssignmentArea[]).map((area) => (
            <label key={area} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <span className="font-medium">{ASSIGNMENT_AREAS[area]}</span>
              <select
                className="h-9 min-w-[14rem] rounded-md border border-input bg-background px-2 text-sm"
                value={ctx.data?.rules?.[area] ?? ""}
                disabled={ctx.isLoading || save.isPending}
                onChange={(e) => save.mutate({ area, assignee: e.target.value || null })}
              >
                <option value="">Niemand (keine Regel)</option>
                {(ctx.data?.staff ?? []).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </CardContent>
      </Card>
      <Card className="border-0 shadow-soft">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="font-medium">Tägliche Zusammenfassung per E-Mail</div>
            <p className="text-xs text-muted-foreground">
              Werktags früh: „Das liegt heute bei dir“ mit Ihren offenen Zahlungen, Nachrichten und
              Anfragen, nur wenn etwas offen ist. Gilt für Sie persönlich.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={digest.data?.enabled ?? true}
              disabled={digest.isLoading || toggleDigest.isPending}
              onChange={(e) => toggleDigest.mutate(e.target.checked)}
            />
            Zusammenfassung erhalten
          </label>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Eine E-Mail bekommt die zuständige Person, wenn ihr ein einzelner Vorgang ausdrücklich
        zugewiesen oder weitergegeben wird, nicht bei Standard-Zuständigkeiten.
      </p>
    </div>
  );
}
