import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Megaphone, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CourseBroadcastDialog } from "@/components/admin/CourseBroadcastDialog";
import { CourseDialog } from "@/components/admin/kurse/CourseDialog";
import { ParticipantsPanel } from "@/components/admin/kurse/ParticipantsPanel";
import { SessionsDialog } from "@/components/admin/kurse/SessionsDialog";
import { courseLabel, type Course } from "@/components/admin/kurse/shared";
import { useCourseData } from "@/components/admin/kurse/useCourseData";
import { useCourseEditor } from "@/components/admin/kurse/useCourseEditor";
import { useParticipants } from "@/components/admin/kurse/useParticipants";
import { useSessions } from "@/components/admin/kurse/useSessions";

export const Route = createFileRoute("/_authenticated/admin/kurs/$courseId")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board"] } });
    } catch {
      throw redirect({ to: "/trainer/kurse" });
    }
  },
  head: () => ({
    meta: [{ title: "Kurs – Verwaltung" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: CoursePage,
});

/**
 * Ein Kurszeitraum als eigene Seite: oben die häufigsten Aktionen (Termine & Trainer, Bearbeiten,
 * Eilnachricht), darunter die Teilnehmerliste mit allen Aktionen. Ersetzt den Teilnehmer-Dialog,
 * der bisher im Kursangebot-Dialog geöffnet wurde.
 */
function CoursePage() {
  const { courseId } = Route.useParams();
  const data = useCourseData();
  const { programs, counts, rows, load } = data;
  const list = useParticipants(programs, load);
  const sessions = useSessions(load);
  const courseEditor = useCourseEditor(load, programs);
  const [broadcast, setBroadcast] = useState<Course | null>(null);
  const course = rows.find((c) => c.id === courseId) ?? null;

  // Teilnehmer laden, sobald Kurs und Angebote da sind (Angebote braucht die Warteliste-Auswahl)
  useEffect(() => {
    if (course) void list.openFor(course);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id, programs.length]);

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Wird geladen …</p>;
  if (!course)
    return (
      <div className="space-y-3">
        <p>Diesen Kurs gibt es nicht (mehr).</p>
        <Button asChild variant="outline">
          <Link to="/admin/kurse">Zur Kursverwaltung</Link>
        </Button>
      </div>
    );

  return (
    <div className="max-w-7xl space-y-6">
      <div className="space-y-3">
        <Link
          to="/admin/kurse"
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kursverwaltung
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-primary-deep">{course.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{courseLabel(course)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void sessions.openSessions(course)}>
              <CalendarDays className="h-4 w-4" aria-hidden="true" /> Termine &amp; Trainer
            </Button>
            <Button variant="outline" onClick={() => courseEditor.startEdit(course)}>
              <Pencil className="h-4 w-4" aria-hidden="true" /> Bearbeiten
            </Button>
            <Button variant="outline" onClick={() => setBroadcast(course)}>
              <Megaphone className="h-4 w-4" aria-hidden="true" /> Eilnachricht an Eltern
            </Button>
          </div>
        </div>
      </div>

      <ParticipantsPanel list={list} counts={counts} programs={programs} courses={rows} />

      <CourseDialog {...courseEditor.dialogProps} />
      <SessionsDialog {...sessions.dialogProps} />
      <CourseBroadcastDialog course={broadcast} onClose={() => setBroadcast(null)} />
    </div>
  );
}
