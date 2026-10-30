import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateBerlin, todayBerlinIso } from "@/lib/format";
import {
  listQualificationOverview,
  setQualificationChecked,
  type QualificationOverviewRow,
} from "@/lib/trainer-extras.functions";
import {
  QUALIFICATION_BOARD_WARN_DAYS,
  QUALIFICATION_KINDS,
  daysUntil,
} from "@/lib/trainer-qualifications";

export const Route = createFileRoute("/_authenticated/admin/qualifikationen")({
  ssr: false,
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board"] } });
    } catch {
      throw redirect({ to: "/portal" });
    }
  },
  component: Page,
  head: () => ({
    meta: [
      { title: "Trainer-Qualifikationen – Verwaltung | Sicher Schwimmen e.V." },
      {
        name: "description",
        content: "Nachweise der Trainer:innen mit Ablaufdatum und Prüfstatus.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Status = "missing" | "expired" | "soon" | "ok" | "none";

function Page() {
  const load = useServerFn(listQualificationOverview);
  const setChecked = useServerFn(setQualificationChecked);
  const [rows, setRows] = useState<QualificationOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [onlyTodo, setOnlyTodo] = useState(false);
  const today = todayBerlinIso();

  async function reload() {
    try {
      setRows(await load());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
  }, []);

  function statusOf(
    row: QualificationOverviewRow,
    kind: (typeof QUALIFICATION_KINDS)[number],
  ): {
    status: Status;
    q?: QualificationOverviewRow["qualifications"][number];
    days: number | null;
  } {
    const q = row.qualifications.find((x) => x.kind === kind.value);
    if (!q) return { status: kind.required ? "missing" : "none", days: null };
    const days = daysUntil(q.valid_until, today);
    if (days === null) return { status: "ok", q, days };
    if (days < 0) return { status: "expired", q, days };
    if (days <= QUALIFICATION_BOARD_WARN_DAYS) return { status: "soon", q, days };
    return { status: "ok", q, days };
  }

  const needsAction = (row: QualificationOverviewRow) =>
    QUALIFICATION_KINDS.some((k) => {
      const s = statusOf(row, k);
      return s.status === "missing" || s.status === "expired" || s.status === "soon";
    });

  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.name.toLowerCase().includes(query.trim().toLowerCase()) &&
          (!onlyTodo || needsAction(r)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, query, onlyTodo],
  );
  const todoCount = rows.filter(needsAction).length;

  async function toggle(trainerId: string, kind: string, checked: boolean) {
    try {
      await setChecked({ data: { trainerId, kind, checked } });
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Konnte nicht gespeichert werden");
    }
  }

  const cell = (row: QualificationOverviewRow, kind: (typeof QUALIFICATION_KINDS)[number]) => {
    const { status, q, days } = statusOf(row, kind);
    if (status === "none") return <span className="text-xs text-muted-foreground">–</span>;
    if (status === "missing")
      return (
        <Badge variant="outline" className="border-destructive text-destructive">
          fehlt
        </Badge>
      );
    const tone =
      status === "expired"
        ? "border-destructive text-destructive"
        : status === "soon"
          ? "border-amber-500 text-amber-700"
          : "text-success";
    return (
      <div className="space-y-1">
        <Badge variant="outline" className={tone}>
          {status === "expired"
            ? "abgelaufen"
            : status === "soon"
              ? `in ${days} Tagen`
              : q?.valid_until
                ? "gültig"
                : "vorhanden"}
        </Badge>
        <div className="text-xs text-muted-foreground">
          {q?.valid_until
            ? `bis ${formatDateBerlin(q.valid_until)}`
            : q?.issued_on
              ? `seit ${formatDateBerlin(q.issued_on)}`
              : ""}
          {q?.note ? ` · ${q.note}` : ""}
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs">
          <Checkbox
            checked={!!q?.checked}
            onCheckedChange={(v) => void toggle(row.trainerId, kind.value, !!v)}
          />
          Nachweis geprüft
        </label>
      </div>
    );
  };

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary-deep">
          Trainer-Qualifikationen
        </h1>
        <p className="text-sm text-muted-foreground">
          Erste Hilfe und erweitertes Führungszeugnis gelten 2 Jahre ab Ausstellung. Trainer tragen
          ihre Nachweise selbst ein und werden 30 Tage vor Ablauf per E-Mail erinnert. Hier
          kontrollieren Sie, was vorliegt, und haken die Prüfung ab. Fehlende oder abgelaufene
          Nachweise sperren die Einteilung nicht.
        </p>
      </div>

      {error ? (
        <Card className="border-0 shadow-soft">
          <CardContent className="py-8 text-center text-muted-foreground">
            Die Übersicht konnte nicht geladen werden. Ist die Migration
            „trainer_qualification_proof“ eingespielt?
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="w-64 pl-8"
                placeholder="Name suchen …"
                aria-label="Trainer suchen"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={onlyTodo} onCheckedChange={(v) => setOnlyTodo(!!v)} />
              Nur mit Handlungsbedarf
            </label>
            <span className="ml-auto flex items-center gap-1.5 text-sm">
              {todoCount > 0 ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  {todoCount} von {rows.length} Trainern mit Handlungsbedarf
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  {loading ? "Wird geladen …" : "Alles in Ordnung"}
                </>
              )}
            </span>
          </div>

          <Card className="border-0 shadow-soft">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    {QUALIFICATION_KINDS.map((k) => (
                      <TableHead key={k.value}>{k.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((r) => (
                    <TableRow key={r.trainerId} className="align-top">
                      <TableCell className="whitespace-nowrap font-medium">{r.name}</TableCell>
                      {QUALIFICATION_KINDS.map((k) => (
                        <TableCell key={k.value}>{cell(r, k)}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {!loading && shown.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={QUALIFICATION_KINDS.length + 1}
                        className="py-8 text-center text-muted-foreground"
                      >
                        Keine Trainer gefunden.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            „In x Tagen“ erscheint ab {QUALIFICATION_BOARD_WARN_DAYS} Tagen vor Ablauf. Ändert eine
            Trainerin den Nachweis, gilt er wieder als ungeprüft.
          </p>
        </>
      )}
    </div>
  );
}
