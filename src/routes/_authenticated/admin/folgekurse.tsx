import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { formatDateBerlin, todayBerlinIso } from "@/lib/format";
import { fetchAll } from "@/lib/fetch-all";
import { beltLabel } from "@/lib/belt";
import { FollowupChildDialog, type CourseOption } from "@/components/admin/FollowupChildDialog";
import {
  buildCandidates,
  GROUP_LABEL,
  LEVEL_LABEL,
  type BookingRow,
  type Candidate,
  type Group,
} from "@/lib/follow-up-candidates";

export const Route = createFileRoute("/_authenticated/admin/folgekurse")({
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
      { title: "Folgekurse – Verwaltung | Sicher Schwimmen e.V." },
      {
        name: "description",
        content:
          "Kinder aus beendeten und laufenden Kursen, die als Nächstes in einen Folgekurs passen.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Raw = {
  id: string;
  participant_name: string | null;
  date_of_birth: string | null;
  participant_email: string | null;
  participant_phone: string | null;
  status: string;
  exam_level: string | null;
  goal_reached: boolean | null;
  badge: string | null;
  belt_blocks: number | null;
  course_id: string;
  courses: { name: string; starts_on: string | null; ends_on: string | null } | null;
  course_requests: {
    parent_name: string | null;
    contact_permission: boolean | null;
    swimming_level: string | null;
  } | null;
};

const GROUPS: Group[] = ["wasserzeit", "schwimmstarter", "seepferdchen", "bronze", "aufbau"];
const BELT_GROUPS: Group[] = ["wasserzeit", "schwimmstarter"];

const GROUP_HELP: Record<Group, string> = {
  wasserzeit:
    "Zuletzt in der Wasserzeit, noch kein späterer Kurs gebucht. Entscheidend ist der Gurt-Stand (weniger Klötzchen = weiter); der Schwimmstarter ist für 4–7 Jahre.",
  schwimmstarter:
    "Zuletzt im Schwimmstarter, noch kein späterer Kurs gebucht. Entscheidend ist der Gurt-Stand (weniger Klötzchen = weiter); das Seepferdchen-Angebot ist ab 5 Jahren.",
  seepferdchen:
    "Hatten bei uns einen Kurs, haben (noch) kein Seepferdchen eingetragen und keinen späteren Kurs gebucht.",
  bronze: "Haben das Seepferdchen und noch keinen späteren Kurs gebucht – passend für Bronze.",
  aufbau:
    "Haben mindestens Bronze (Prüfung eingetragen oder von den Eltern angegeben) und noch keinen späteren Kurs gebucht.",
};

function Page() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group>("seepferdchen");
  const [search, setSearch] = useState("");
  const [onlyOk, setOnlyOk] = useState(false);
  // Gurt-Filter (nur Wasserzeit/Schwimmstarter): höchstens so viele Klötzchen; "" = alle
  const [maxBelt, setMaxBelt] = useState("");

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);

  async function load() {
    {
      try {
        const raw = await fetchAll<Raw>((from, to) =>
          supabase
            .from("course_participants")
            .select(
              "id,participant_name,date_of_birth,participant_email,participant_phone,status,exam_level,goal_reached,badge,belt_blocks,course_id,courses!course_participants_course_id_fkey(name,starts_on,ends_on),course_requests(parent_name,contact_permission,swimming_level)",
            )
            .order("id")
            .range(from, to),
        );
        const waiting = await fetchAll<{ child_name: string | null; child_dob: string | null }>(
          (from, to) =>
            supabase
              .from("waitlist_entries")
              .select("child_name,child_dob")
              .eq("status", "waiting")
              .order("id")
              .range(from, to),
        );
        const rows: BookingRow[] = raw.map((r) => ({
          id: r.id,
          participant_name: r.participant_name,
          date_of_birth: r.date_of_birth,
          participant_email: r.participant_email,
          participant_phone: r.participant_phone,
          status: r.status,
          exam_level: r.exam_level,
          goal_reached: r.goal_reached,
          badge: r.badge,
          belt_blocks: r.belt_blocks,
          course_name: r.courses?.name ?? "—",
          starts_on: r.courses?.starts_on ?? null,
          ends_on: r.courses?.ends_on ?? null,
          parent_name: r.course_requests?.parent_name ?? null,
          contact_permission: r.course_requests?.contact_permission ?? null,
          request_level: r.course_requests?.swimming_level ?? null,
        }));
        const today = todayBerlinIso();
        setCandidates(buildCandidates(rows, waiting, today));

        // Kommende Kurse mit freien Plätzen für „anbieten/zubuchen“
        const booked = new Map<string, number>();
        for (const r of raw)
          if (r.status === "confirmed") booked.set(r.course_id, (booked.get(r.course_id) ?? 0) + 1);
        const { data: upcoming, error } = await supabase
          .from("courses")
          .select("id,name,starts_on,ends_on,schedule,max_participants")
          .is("archived_at", null)
          .gt("starts_on", today)
          .order("starts_on");
        if (error) throw new Error(error.message);
        setCourses(
          (upcoming ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            starts_on: c.starts_on as string,
            ends_on: c.ends_on,
            schedule: c.schedule,
            free:
              c.max_participants == null
                ? null
                : Math.max(0, c.max_participants - (booked.get(c.id) ?? 0)),
          })),
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Laden fehlgeschlagen");
      } finally {
        setLoading(false);
      }
    }
  }
  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(
    () =>
      Object.fromEntries(GROUPS.map((g) => [g, candidates.filter((c) => c.group === g).length])),
    [candidates],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = candidates.filter(
      (c) =>
        c.group === group &&
        (!onlyOk || c.contactOk === true) &&
        (!maxBelt || (c.belt != null && c.belt <= Number(maxBelt))) &&
        (!q || `${c.name} ${c.parent} ${c.email} ${c.lastCourse}`.toLowerCase().includes(q)),
    );
    // Bei Wasserzeit/Schwimmstarter: Kinder mit den wenigsten Klötzchen zuerst, ohne Eintrag zuletzt
    return BELT_GROUPS.includes(group)
      ? [...list].sort((a, b) => (a.belt ?? 99) - (b.belt ?? 99))
      : list;
  }, [candidates, group, search, onlyOk, maxBelt]);

  async function download() {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    for (const g of GROUPS) {
      const ws = wb.addWorksheet(
        {
          wasserzeit: "Wasserzeit → Schwimmstarter",
          schwimmstarter: "Schwimmstarter → Seepferdchen",
          seepferdchen: "Seepferdchen offen",
          bronze: "Bereit für Bronze",
          aufbau: "Aufbaukurs",
        }[g],
      );
      ws.columns = [
        { header: "Kind", width: 24 },
        { header: "Alter", width: 7 },
        { header: "Eltern", width: 24 },
        { header: "E-Mail", width: 32 },
        { header: "Telefon", width: 18 },
        { header: "Kontakt erlaubt", width: 16 },
        { header: "Letzter Kurs", width: 40 },
        { header: "Zeitraum", width: 24 },
        { header: "Stand", width: 10 },
        { header: "Einstufung", width: 22 },
        { header: "Quelle der Einstufung", width: 20 },
        { header: "Gurt-Stand", width: 16 },
        { header: "Auf Warteliste", width: 14 },
        { header: "Alle bisherigen Kurse", width: 60 },
      ];
      for (const c of candidates.filter((x) => x.group === g)) {
        ws.addRow([
          c.name,
          c.age ?? "",
          c.parent,
          c.email,
          c.phone,
          contactText(c),
          c.lastCourse,
          `${formatDateBerlin(c.lastStart)} – ${formatDateBerlin(c.lastEnd)}`,
          c.phase,
          LEVEL_LABEL[c.level],
          c.levelSource,
          beltLabel(c.belt),
          c.onWaitlist ? "ja" : "",
          c.courses.join(" | "),
        ]);
      }
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: "frozen", ySplit: 1 }];
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
    }
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    a.download = `folgekurse-${todayBerlinIso()}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Kinder, die bei uns einen Kurs hatten oder gerade haben, aber noch keinen späteren Kurs
          gebucht haben – nach Stand des Kindes in fünf Gruppen. Ein Klick auf den Namen zeigt den
          Verlauf und lässt dich einen Kursplatz anbieten oder direkt zubuchen. Stornierte Buchungen
          zählen nicht.
        </p>
        <Button variant="outline" onClick={download} disabled={loading || !candidates.length}>
          <Download className="mr-2 h-4 w-4" /> Excel herunterladen
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={`rounded-lg border p-4 text-left transition ${
              group === g ? "border-accent bg-accent/10" : "border-border hover:bg-muted/40"
            }`}
          >
            <div className="text-3xl font-bold text-primary-deep">{counts[g] ?? 0}</div>
            <div className="text-sm font-semibold">{GROUP_LABEL[g]}</div>
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{GROUP_HELP[group]}</p>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          className="max-w-xs"
          placeholder="Suche nach Kind, Eltern, Kurs …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <Checkbox id="only-ok" checked={onlyOk} onCheckedChange={(v) => setOnlyOk(v === true)} />
          <Label htmlFor="only-ok" className="text-sm">
            Nur Eltern mit Kontakt-Erlaubnis
          </Label>
        </div>
        {
          <div className="flex items-center gap-2">
            <Label htmlFor="max-belt" className="text-sm">
              Gurt-Stand
            </Label>
            <select
              id="max-belt"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={maxBelt}
              onChange={(e) => setMaxBelt(e.target.value)}
            >
              <option value="">alle</option>
              <option value="4">höchstens 4 Klötzchen</option>
              <option value="3">höchstens 3 Klötzchen</option>
              <option value="2">höchstens 2 Klötzchen</option>
              <option value="1">höchstens 1 Klötzchen</option>
              <option value="0">ohne Gurt</option>
            </select>
          </div>
        }
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Lade …</p>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Keine Kinder in dieser Gruppe.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2">Kind</th>
                <th className="p-2">Eltern / Kontakt</th>
                <th className="p-2">Letzter Kurs</th>
                <th className="p-2">Stand des Kindes</th>
                <th className="p-2">Kontakt</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.key} className="border-t border-border align-top">
                  <td className="p-2">
                    <button
                      type="button"
                      className="text-left font-semibold text-primary underline-offset-2 hover:underline"
                      onClick={() => setSelected(c)}
                    >
                      {c.name}
                    </button>
                    <div className="text-xs text-muted-foreground">
                      {c.age != null ? `${c.age} Jahre` : "Alter unbekannt"}
                    </div>
                  </td>
                  <td className="p-2">
                    <div>{c.parent || "—"}</div>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                    <div className="text-xs text-muted-foreground">{c.phone}</div>
                  </td>
                  <td className="p-2">
                    <div>{c.lastCourse}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateBerlin(c.lastStart)} – {formatDateBerlin(c.lastEnd)}
                    </div>
                    <Badge variant={c.phase === "läuft" ? "default" : "secondary"}>{c.phase}</Badge>
                  </td>
                  <td className="p-2">
                    {!BELT_GROUPS.includes(c.group) && (
                      <>
                        <div>{LEVEL_LABEL[c.level]}</div>
                        <div className="text-xs text-muted-foreground">{c.levelSource}</div>
                      </>
                    )}
                    <div
                      className={
                        BELT_GROUPS.includes(c.group) ? "" : "text-xs text-muted-foreground"
                      }
                    >
                      Gurt: {beltLabel(c.belt)}
                    </div>
                    {c.courses.length > 1 && (
                      <div className="text-xs text-muted-foreground">
                        {c.courses.length} Kurse bei uns
                      </div>
                    )}
                  </td>
                  <td className="p-2">
                    <div>{contactText(c)}</div>
                    {c.onWaitlist && <Badge variant="outline">auf Warteliste</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FollowupChildDialog
        candidate={selected}
        courses={courses}
        onClose={() => setSelected(null)}
        onDone={load}
      />

      <p className="text-xs text-muted-foreground">
        Der Stand stammt aus den Prüfungen, die Trainer:innen im Kurs eintragen, sonst aus der
        Angabe der Eltern bei der Anfrage. Ohne beides steht „kein Abzeichen erfasst“. Bei laufenden
        Kursen ist das Ergebnis oft noch offen.
      </p>
    </div>
  );
}

function contactText(c: Candidate): string {
  if (c.contactOk === true) return "Kontakt erlaubt";
  if (c.contactOk === false) return "Kontakt nicht erlaubt";
  return "unbekannt (Direktbuchung)";
}
