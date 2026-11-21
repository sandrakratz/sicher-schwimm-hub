import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResultForm } from "@/components/trainer/ParticipantResultEditor";
import {
  deleteExternalExam,
  exportExternalExamProtocol,
  listExternalExamDay,
  saveExternalExam,
  type ExternalExam,
  type ExternalExamDay,
} from "@/lib/external-exams.functions";
import { exportExamProtocol } from "@/lib/trainer-courses.functions";
import { examLevelLabel, type ExamCriteriaState } from "@/lib/swim-exams";
import { formatDateBerlin, todayBerlinIso } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/trainer/abnahme")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board", "trainer"] } });
    } catch {
      throw redirect({ to: "/portal" });
    }
  },
  component: Page,
  head: () => ({
    meta: [
      { title: "Abzeichen abnehmen – Trainerbereich | Sicher Schwimmen e.V." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const NO_COURSE = "none";

function resultText(e: ExternalExam): string {
  const level = e.exam_level ? examLevelLabel(e.exam_level) : e.badge || "Keine Stufe";
  const result =
    e.goal_reached === true ? "bestanden" : e.goal_reached === false ? "nicht bestanden" : "offen";
  return `${level} · ${result}`;
}

function Page() {
  const loadDay = useServerFn(listExternalExamDay);
  const saveFn = useServerFn(saveExternalExam);
  const deleteFn = useServerFn(deleteExternalExam);
  const exportCourse = useServerFn(exportExamProtocol);
  const exportStandalone = useServerFn(exportExternalExamProtocol);

  const [examDate, setExamDate] = useState(todayBerlinIso());
  const [day, setDay] = useState<ExternalExamDay | null>(null);
  const [courseId, setCourseId] = useState(NO_COURSE);
  const [location, setLocation] = useState("");
  const [editing, setEditing] = useState<ExternalExam | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [origin, setOrigin] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await loadDay({ data: { examDate } });
      setDay(res);
      return res;
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Laden fehlgeschlagen");
      return null;
    }
  }, [examDate, loadDay]);

  // Datum gewechselt: neu laden und den Kurs dieses Tages vorschlagen (falls vorhanden)
  useEffect(() => {
    setEditing(null);
    setDay(null);
    (async () => {
      const res = await reload();
      setCourseId(res?.courses.length ? res.courses[0].id : NO_COURSE);
    })();
  }, [reload]);

  function startEdit(e: ExternalExam) {
    setEditing(e);
    setName(e.person_name);
    setDob(e.date_of_birth);
    setOrigin(e.origin ?? "");
    setCourseId(e.course_id ?? NO_COURSE);
    setLocation(e.location ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditing(null);
    setName("");
    setDob("");
    setFormKey((k) => k + 1);
  }

  async function remove(e: ExternalExam) {
    if (!window.confirm(`Abnahme von ${e.person_name} wirklich löschen?`)) return;
    try {
      await deleteFn({ data: { id: e.id } });
      if (editing?.id === e.id) resetForm();
      await reload();
      toast.success("Abnahme gelöscht");
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Löschen fehlgeschlagen");
    }
  }

  async function downloadProtocol(
    key: string,
    run: () => Promise<{ filename: string; base64: string }>,
  ) {
    setExporting(key);
    try {
      const res = await run();
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Export fehlgeschlagen");
    } finally {
      setExporting(null);
    }
  }

  // Abnahmen nach Protokoll gruppieren: je Kurs ein Protokoll, ohne Kurs je Ort
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { key: string; courseId: string | null; location: string | null; entries: ExternalExam[] }
    >();
    for (const e of day?.entries ?? []) {
      const key = e.course_id ?? `loc:${e.location ?? ""}`;
      const g = map.get(key) ?? { key, courseId: e.course_id, location: e.location, entries: [] };
      g.entries.push(e);
      map.set(key, g);
    }
    return [...map.values()];
  }, [day]);

  const courseName = (id: string | null) =>
    id ? (day?.courses.find((c) => c.id === id)?.name ?? "Kurs") : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">Abzeichen abnehmen</h1>
        <p className="text-sm text-muted-foreground">
          Für Kinder ohne Kursbuchung, z. B. aus anderen Schwimmschulen. Die Abnahme erscheint im
          Prüfungsprotokoll des Kurses dieses Tages oder in einem eigenen Protokoll für den
          Abnahmetermin.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editing ? `Abnahme ändern: ${editing.person_name}` : "Neue Abnahme"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Datum der Abnahme</Label>
              <Input
                type="date"
                className="h-9"
                value={examDate}
                disabled={Boolean(editing)}
                onChange={(e) => e.target.value && setExamDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Protokoll</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(day?.courses ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      Kurs: {c.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NO_COURSE}>Eigener Abnahmetermin (ohne Kurs)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {courseId === NO_COURSE && (
            <div>
              <Label className="text-xs">Ort der Abnahme</Label>
              <Input
                className="h-9"
                placeholder="z. B. Kurhaus Hennef"
                value={location}
                maxLength={120}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Name des Kindes</Label>
              <Input
                className="h-9"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Geburtsdatum</Label>
              <Input
                type="date"
                className="h-9"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Herkunft (optional)</Label>
              <Input
                className="h-9"
                placeholder="z. B. andere Schwimmschule"
                value={origin}
                maxLength={120}
                onChange={(e) => setOrigin(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Bitte nur Name, Geburtsdatum und Prüfungsergebnis erfassen, keine Gesundheitsangaben.
          </p>

          <ResultForm
            key={editing?.id ?? `new-${formKey}`}
            showExamDate={false}
            value={{
              goal_reached: editing?.goal_reached ?? null,
              badge: editing?.badge ?? null,
              achievement: editing?.achievement ?? null,
              exam_level: editing?.exam_level ?? null,
              exam_criteria: (editing?.exam_criteria ?? {}) as ExamCriteriaState,
              exam_pass_no: editing?.exam_pass_no ?? null,
              exam_date: examDate,
            }}
            save={async (input) => {
              if (courseId === NO_COURSE && !location.trim())
                throw new Error("Bitte den Ort der Abnahme angeben.");
              const saved = await saveFn({
                data: {
                  ...input,
                  id: editing?.id ?? null,
                  examDate,
                  courseId: courseId === NO_COURSE ? null : courseId,
                  location: courseId === NO_COURSE ? location : null,
                  personName: name,
                  dateOfBirth: dob,
                  origin,
                },
              });
              return {
                goal_reached: saved.goal_reached,
                badge: saved.badge,
                achievement: saved.achievement,
                exam_level: saved.exam_level,
                exam_criteria: saved.exam_criteria,
                exam_date: saved.exam_date,
                exam_pass_no: saved.exam_pass_no,
              };
            }}
            onSaved={async () => {
              resetForm();
              await reload();
            }}
          />
          {editing && (
            <Button variant="outline" size="sm" onClick={resetForm}>
              Bearbeiten abbrechen
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Abnahmen am {formatDateBerlin(examDate)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!day && <p className="text-sm text-muted-foreground">Lädt…</p>}
          {day && groups.length === 0 && (
            <p className="text-sm text-muted-foreground">
              An diesem Tag sind noch keine externen Abnahmen erfasst.
            </p>
          )}
          {groups.map((g) => (
            <div key={g.key} className="rounded-md border p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {g.courseId
                    ? `Protokoll: Kurs ${courseName(g.courseId)}`
                    : `Protokoll: Abnahmetermin${g.location ? `, ${g.location}` : ""}`}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exporting === g.key}
                  onClick={() =>
                    downloadProtocol(g.key, () =>
                      g.courseId
                        ? exportCourse({ data: { courseId: g.courseId } })
                        : exportStandalone({ data: { examDate, location: g.location } }),
                    )
                  }
                >
                  {exporting === g.key ? "Erstellt…" : "Protokoll (PDF)"}
                </Button>
              </div>
              <ul className="divide-y">
                {g.entries.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {e.person_name}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          geb. {formatDateBerlin(e.date_of_birth)}
                          {e.origin ? ` · ${e.origin}` : ""}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">{resultText(e)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(e)}>
                        Bearbeiten
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(e)}>
                        Löschen
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
