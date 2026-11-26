import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CourseBroadcastDialog } from "@/components/admin/CourseBroadcastDialog";
import { CourseSessionsMailDialog } from "@/components/admin/CourseSessionsMailDialog";
import { CourseDialog } from "@/components/admin/kurse/CourseDialog";
import { ProgramDetail } from "@/components/admin/kurse/ProgramDetail";
import { SessionsDialog } from "@/components/admin/kurse/SessionsDialog";
import { SessionCancelDialog } from "@/components/admin/kurse/SessionCancelDialog";
import type { TermContext } from "@/components/admin/kurse/TermCard";
import type { Course } from "@/components/admin/kurse/shared";
import { useCourseData } from "@/components/admin/kurse/useCourseData";
import { useCourseEditor } from "@/components/admin/kurse/useCourseEditor";
import { useCourseExports } from "@/components/admin/kurse/useCourseExports";
import { useProgramEditor } from "@/components/admin/kurse/useProgramEditor";
import { useSessions } from "@/components/admin/kurse/useSessions";

/** `ohne` = Kurszeiträume, die keinem Kursangebot zugeordnet sind. */
const UNASSIGNED = "ohne";

export const Route = createFileRoute("/_authenticated/admin/kursangebot/$programId")({
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
    meta: [{ title: "Kursangebot – Verwaltung" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ProgramPage,
});

/**
 * Ein Kursangebot (z. B. Seepferdchen) als eigene Seite: Reiter „Kurszeiträume“ mit allen Aktionen
 * je Zeitraum und „Kursangaben“ für die Webseite. Ersetzt den Kursangebot-Dialog.
 */
function ProgramPage() {
  const { programId } = Route.useParams();
  const navigate = useNavigate();
  const data = useCourseData();
  const { programs, counts, load } = data;
  const exports = useCourseExports();
  const programEditor = useProgramEditor(programs, load);
  const courseEditor = useCourseEditor(load, programs);
  const sessions = useSessions(load);
  const [broadcastCourse, setBroadcastCourse] = useState<Course | null>(null);
  const [sessionsMailCourse, setSessionsMailCourse] = useState<Course | null>(null);

  const unassigned = programId === UNASSIGNED;
  const program = unassigned ? null : (programs.find((p) => p.id === programId) ?? null);

  // Angaben zum Bearbeiten übernehmen, sobald das Angebot geladen ist
  useEffect(() => {
    if (program) programEditor.edit(program);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program?.id]);

  const termContext: TermContext = {
    programs,
    counts,
    waitingFor: data.waitingFor,
    exports,
    onParticipants: (c) =>
      void navigate({ to: "/admin/kurs/$courseId", params: { courseId: c.id } }),
    onSessions: sessions.openSessions,
    onEdit: courseEditor.startEdit,
    onBroadcast: setBroadcastCourse,
    onSessionsMail: setSessionsMailCourse,
    onArchive: data.setArchived,
    onRemove: data.removeCourse,
    onReload: load,
  };

  const back = (
    <Link
      to="/admin/kurse"
      className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kursverwaltung
    </Link>
  );

  if (programs.length === 0 && data.rows.length === 0)
    return <p className="text-sm text-muted-foreground">Wird geladen …</p>;
  if (!unassigned && !program)
    return (
      <div className="space-y-3">
        {back}
        <p>Dieses Kursangebot gibt es nicht (mehr).</p>
        <Button asChild variant="outline">
          <Link to="/admin/kurse">Zur Kursverwaltung</Link>
        </Button>
      </div>
    );

  return (
    <div className="max-w-7xl space-y-6">
      <div className="space-y-3">
        {back}
        <h1 className="font-display text-3xl font-bold text-primary-deep">
          {program?.name ?? "Zeiträume ohne Kursangebot"}
        </h1>
      </div>

      <ProgramDetail
        editor={programEditor}
        program={program}
        terms={data.termsOf(unassigned ? null : programId)}
        onNewTerm={courseEditor.startNewTerm}
        ctx={termContext}
        onDeleted={() => void navigate({ to: "/admin/kurse" })}
      />

      <CourseDialog {...courseEditor.dialogProps} />
      <SessionsDialog {...sessions.dialogProps} />
      {sessions.cancelProps && <SessionCancelDialog {...sessions.cancelProps} />}
      <CourseBroadcastDialog course={broadcastCourse} onClose={() => setBroadcastCourse(null)} />
      <CourseSessionsMailDialog
        course={sessionsMailCourse}
        onClose={() => setSessionsMailCourse(null)}
      />
    </div>
  );
}
