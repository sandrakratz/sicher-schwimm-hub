import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { supabase } from "@/integrations/supabase/client";
import { downloadBase64 } from "@/lib/download";
import { formatDateBerlin, todayBerlinIso } from "@/lib/format";
import {
  generateCourseConfirmations,
  generateCourseListXlsx,
  generateMeinVereinCsv,
  generateTaxParticipantListXlsx,
  generateTrainerProofXlsx,
} from "@/lib/course-sessions.functions";
import { exportExamProtocol } from "@/lib/trainer-courses.functions";
import { YearBundle } from "@/components/admin/downloads/YearBundle";
import { DEFAULT_AGE_BOUNDS } from "@/lib/reports";
import { exportExternalExamProtocol } from "@/lib/external-exams.functions";
import { exportFamilySwimAttendance } from "@/lib/familienschwimmen.functions";
import {
  exportBadgeStats,
  exportDemand,
  exportMemberRoster,
  exportMembershipCensus,
  exportQualifications,
  exportSubjectAccess,
  listExternalExamDays,
} from "@/lib/reports.functions";

export const Route = createFileRoute("/_authenticated/admin/downloads")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board"] } });
    } catch {
      throw redirect({ to: "/admin/benutzer" });
    }
  },
  head: () => ({ meta: [{ title: "Downloads – Verwaltung | Sicher Schwimmen e.V." }] }),
  component: Page,
});

const MIME = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
  zip: "application/zip",
  csv: "text/csv;charset=utf-8",
} as const;

type FileRes = { filename: string; base64: string };

/** Ein Download-Knopf: erstellt die Datei auf dem Server und speichert sie im Browser. */
function DownloadButton({
  label,
  kind,
  run,
  disabled,
  hint,
}: {
  label: string;
  kind: keyof typeof MIME;
  run: () => Promise<FileRes>;
  disabled?: boolean;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={busy || disabled}
      title={hint}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await run();
          downloadBase64(res.base64, res.filename, MIME[kind]);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Download fehlgeschlagen.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {label}
      <span className="text-xs text-muted-foreground">{kind.toUpperCase()}</span>
    </Button>
  );
}

function Section({
  title,
  text,
  controls,
  children,
}: {
  title: string;
  text: string;
  controls?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-0 shadow-soft">
      <CardContent className="space-y-3 p-5">
        <div>
          <h2 className="font-display text-xl font-bold text-primary-deep">{title}</h2>
          <p className="text-sm text-muted-foreground">{text}</p>
        </div>
        {controls && <div className="flex flex-wrap items-end gap-3">{controls}</div>}
        <div className="flex flex-wrap gap-2">{children}</div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

type CourseOption = { id: string; name: string; starts_on: string | null; ends_on: string | null };

function Page() {
  const thisYear = new Date().getFullYear();
  // Im Januar/Februar wird meist das Vorjahr gebraucht
  const defaultYear = new Date().getMonth() < 2 ? thisYear - 1 : thisYear;
  const years = Array.from({ length: thisYear - 2024 + 1 }, (_, i) => thisYear + 1 - i).filter(
    (y) => y >= 2025,
  );
  const [year, setYear] = useState(defaultYear);
  const [courseYear, setCourseYear] = useState(thisYear);
  const [courseId, setCourseId] = useState("");
  const [day, setDay] = useState(todayBerlinIso());
  const [examDay, setExamDay] = useState("");
  const [email, setEmail] = useState("");
  // Bestandserhebung: üblicher Stichtag ist der 1. Januar
  const [censusDay, setCensusDay] = useState(`${thisYear}-01-01`);
  const [bounds, setBounds] = useState(DEFAULT_AGE_BOUNDS.join(", "));
  const boundList = bounds
    .split(/[,;\s]+/)
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 120);

  const courses = useQuery({
    queryKey: ["downloads-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id,name,starts_on,ends_on")
        .order("starts_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CourseOption[];
    },
  });
  const examDays = useQuery({
    queryKey: ["downloads-exam-days"],
    queryFn: () => listExternalExamDays(),
  });

  const courseList = useMemo(
    () => (courses.data ?? []).filter((c) => (c.starts_on ?? "").startsWith(`${courseYear}-`)),
    [courses.data, courseYear],
  );
  const course = courseList.find((c) => c.id === courseId) ?? null;
  const started = !!course?.starts_on && course.starts_on <= todayBerlinIso();
  const exam = (examDays.data ?? []).find((d) => `${d.date}|${d.location ?? ""}` === examDay);

  const yearSelect = (value: number, onChange: (y: number) => void, label = "Jahr") => (
    <Field label={label}>
      <NativeSelect value={String(value)} onChange={(e) => onChange(Number(e.target.value))}>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary-deep">Downloads</h1>
        <p className="text-sm text-muted-foreground">
          Alle Listen und Nachweise der Verwaltung an einem Ort: erst wählen, wofür (Kurs, Jahr,
          Stichtag), dann herunterladen. Jeder Download wird im Audit-Log vermerkt. Dateien mit
          Namen bitte nur im Vorstand weitergeben.
        </p>
      </div>

      <Section
        title="Zu einem Kurs"
        text="Listen und Bescheinigungen eines Kurszeitraums – dieselben wie im Menü am Kurs."
        controls={
          <>
            {yearSelect(
              courseYear,
              (y) => {
                setCourseYear(y);
                setCourseId("");
              },
              "Kursbeginn im Jahr",
            )}
            <Field label="Kurs">
              <NativeSelect
                className="min-w-80"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              >
                <option value="">
                  {courses.isLoading ? "Lädt …" : `Kurs wählen (${courseList.length}) …`}
                </option>
                {courseList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.starts_on ? ` · ab ${formatDateBerlin(c.starts_on)}` : ""}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </>
        }
      >
        <DownloadButton
          label="Teilnehmerliste"
          kind="xlsx"
          disabled={!course}
          run={() => generateCourseListXlsx({ data: { courseId } })}
        />
        <DownloadButton
          label="Steuerliste"
          kind="xlsx"
          disabled={!course || !started}
          hint={course && !started ? "Erst ab Kursbeginn" : undefined}
          run={() => generateTaxParticipantListXlsx({ data: { courseId } })}
        />
        <DownloadButton
          label="Kursbestätigungen"
          kind="pdf"
          disabled={!course}
          run={() => generateCourseConfirmations({ data: { courseId, format: "pdf" } })}
        />
        <DownloadButton
          label="Kursbestätigungen einzeln"
          kind="zip"
          disabled={!course}
          run={() => generateCourseConfirmations({ data: { courseId, format: "zip" } })}
        />
        <DownloadButton
          label="Prüfungsprotokoll"
          kind="pdf"
          disabled={!course}
          run={() => exportExamProtocol({ data: { courseId } })}
        />
        <DownloadButton
          label="MeinVerein-Import"
          kind="csv"
          disabled={!course}
          run={() => generateMeinVereinCsv({ data: { courseId } })}
        />
      </Section>

      <Section
        title="Für ein Jahr"
        text="Nachweise und Auswertungen über alle Kurse eines Kalenderjahres. Statistik und Auslastung enthalten nur Zahlen, keine Namen. Darunter die Kurslisten aller Kurse mit Beginn im Jahr (Kurse über den Jahreswechsel zählen zum Startjahr)."
        controls={yearSelect(year, setYear)}
      >
        <DownloadButton
          label={`Trainer-Nachweis ${year}`}
          kind="xlsx"
          run={() => generateTrainerProofXlsx({ data: { year } })}
        />
        <DownloadButton
          label={`Abzeichen-Statistik ${year}`}
          kind="xlsx"
          run={() => exportBadgeStats({ data: { year } })}
        />
        <DownloadButton
          label={`Auslastung & Nachfrage ${year}`}
          kind="xlsx"
          run={() => exportDemand({ data: { year } })}
        />
        <DownloadButton
          label={`Mitgliederschwimmen: Anwesenheit ${year}`}
          kind="pdf"
          run={() => exportFamilySwimAttendance({ data: { year } })}
        />
        <YearBundle year={year} courses={courses.data ?? []} />
      </Section>

      <Section
        title="Mitglieder zum Stichtag"
        text="Alle Mitglieder einschließlich Partner:in und Kinder aus dem Antrag – z. B. für die Mitgliederversammlung oder den Abgleich mit WISO MeinVerein. Im ersten Blatt „Abfrage“ lassen sich Geschlecht, Alter von–bis, Mitgliedsart und Rolle auswählen – Excel zählt sofort, z. B. für Meldungen an Verbände."
        controls={
          <Field label="Stichtag">
            <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
        }
      >
        <DownloadButton
          label="Mitgliederliste"
          kind="xlsx"
          disabled={!/^\d{4}-\d{2}-\d{2}$/.test(day)}
          run={() => exportMemberRoster({ data: { day } })}
        />
      </Section>

      <Section
        title="Bestandsmeldung (Landessportbund)"
        text="Anzahl aller Mitglieder einschließlich Familienmitglieder nach Altersgruppe und Geschlecht, ohne Namen. Ein zweites Blatt listet, bei wem Geschlecht oder Geburtsdatum noch fehlen. Die Altersgruppen sind einstellbar (Obergrenzen „bis einschließlich“), falls der Verband sie ändert."
        controls={
          <>
            <Field label="Stichtag">
              <Input type="date" value={censusDay} onChange={(e) => setCensusDay(e.target.value)} />
            </Field>
            <Field label="Altersgruppen bis (Jahre)">
              <Input
                className="w-56"
                value={bounds}
                onChange={(e) => setBounds(e.target.value)}
                placeholder="6, 14, 18, 26, 40, 60"
              />
            </Field>
          </>
        }
      >
        <DownloadButton
          label="Bestandsmeldung"
          kind="xlsx"
          disabled={!/^\d{4}-\d{2}-\d{2}$/.test(censusDay) || boundList.length === 0}
          run={() => exportMembershipCensus({ data: { day: censusDay, bounds: boundList } })}
        />
      </Section>

      <Section
        title="Trainer:innen"
        text="Nachweise (Erste Hilfe, Führungszeugnis, Rettungsschwimmer …) mit Ablaufdatum; fehlende Pflichtnachweise sind markiert."
      >
        <DownloadButton label="Qualifikationen" kind="xlsx" run={() => exportQualifications()} />
      </Section>

      <Section
        title="Abnahme ohne Kursbuchung"
        text="Prüfungsprotokoll für Abnahmetermine mit Kindern ohne Kurs (z. B. aus anderen Schwimmschulen)."
        controls={
          <Field label="Abnahmetermin">
            <NativeSelect
              className="min-w-72"
              value={examDay}
              onChange={(e) => setExamDay(e.target.value)}
            >
              <option value="">
                {examDays.isLoading
                  ? "Lädt …"
                  : (examDays.data ?? []).length === 0
                    ? "Noch keine Abnahmen ohne Kurs"
                    : "Termin wählen …"}
              </option>
              {(examDays.data ?? []).map((d) => (
                <option
                  key={`${d.date}|${d.location ?? ""}`}
                  value={`${d.date}|${d.location ?? ""}`}
                >
                  {formatDateBerlin(d.date)}
                  {d.location ? ` · ${d.location}` : ""} ({d.count})
                </option>
              ))}
            </NativeSelect>
          </Field>
        }
      >
        <DownloadButton
          label="Prüfungsprotokoll"
          kind="pdf"
          disabled={!exam}
          run={() =>
            exportExternalExamProtocol({
              data: { examDate: exam!.date, location: exam!.location },
            })
          }
        />
      </Section>

      <Section
        title="Datenauskunft (DSGVO)"
        text="Alle gespeicherten Daten zu einer E-Mail-Adresse, wenn jemand Auskunft verlangt (Art. 15 DSGVO). Die Datei vor dem Versand prüfen. Auch in der Familienakte abrufbar."
        controls={
          <Field label="E-Mail-Adresse">
            <Input
              type="email"
              className="min-w-80"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="eltern@example.org"
            />
          </Field>
        }
      >
        <DownloadButton
          label="Datenauskunft"
          kind="xlsx"
          disabled={!/^\S+@\S+\.\S+$/.test(email.trim())}
          run={() => exportSubjectAccess({ data: { email: email.trim() } })}
        />
      </Section>

      <Card className="border-0 shadow-soft">
        <CardContent className="space-y-2 p-5">
          <h2 className="font-display text-xl font-bold text-primary-deep">
            Auf der jeweiligen Seite
          </h2>
          <p className="text-sm text-muted-foreground">
            Diese Listen richten sich nach den Filtern der Seite und werden dort heruntergeladen.
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["/admin/uebungsleitergelder", "Übungsleitergelder: Abrechnung & IBAN-Liste"],
                ["/admin/folgekurse", "Folgekurse"],
                ["/admin/erwachsenenkurs", "Erwachsenen-Interessenten"],
                ["/admin/widerrufe", "Widerrufe"],
                ["/admin/dokumente", "Vereinsdokumente"],
              ] as const
            ).map(([to, label]) => (
              <Button key={to} asChild variant="ghost">
                <Link to={to}>
                  {label} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
