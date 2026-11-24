import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CourseBroadcastDialog } from "@/components/admin/CourseBroadcastDialog";
import { CourseSessionsMailDialog } from "@/components/admin/CourseSessionsMailDialog";
import { CourseDialog } from "@/components/admin/kurse/CourseDialog";
import { HeaderActions } from "@/components/admin/kurse/HeaderActions";
import { ProgramCards } from "@/components/admin/kurse/ProgramCards";
import { ProgramDetailDialog } from "@/components/admin/kurse/ProgramDetailDialog";
import { ProgramDialog } from "@/components/admin/kurse/ProgramDialog";
import { SessionsDialog } from "@/components/admin/kurse/SessionsDialog";
import type { TermContext } from "@/components/admin/kurse/TermCard";
import type { Course } from "@/components/admin/kurse/shared";
import { useCourseData } from "@/components/admin/kurse/useCourseData";
import { useCourseEditor } from "@/components/admin/kurse/useCourseEditor";
import { useCourseExports } from "@/components/admin/kurse/useCourseExports";
import { useProgramEditor } from "@/components/admin/kurse/useProgramEditor";
import { useSessions } from "@/components/admin/kurse/useSessions";

export const Route = createFileRoute("/_authenticated/admin/kurse")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    // Trainer:innen arbeiten im Trainerbereich („Meine Kurse“); die Kursverwaltung ist Vorstand/Admin vorbehalten
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board"] } });
    } catch {
      throw redirect({ to: "/trainer/kurse" });
    }
  },
  component: Page,
});

function Page() {
  const data = useCourseData();
  const { programs, counts, load } = data;
  const exports = useCourseExports();
  const programEditor = useProgramEditor(programs, load);
  const courseEditor = useCourseEditor(load, programs);
  const sessions = useSessions(load);
  // Teilnehmer eines Kurszeitraums haben eine eigene Seite (statt Dialog im Kursangebot-Dialog)
  const navigate = useNavigate();
  const openParticipants = (c: Course) =>
    void navigate({ to: "/admin/kurs/$courseId", params: { courseId: c.id } });
  const [broadcastCourse, setBroadcastCourse] = useState<Course | null>(null);
  const [sessionsMailCourse, setSessionsMailCourse] = useState<Course | null>(null);

  const termContext: TermContext = {
    programs,
    counts,
    waitingFor: data.waitingFor,
    exports,
    onParticipants: openParticipants,
    onSessions: sessions.openSessions,
    onEdit: courseEditor.startEdit,
    onBroadcast: setBroadcastCourse,
    onSessionsMail: setSessionsMailCourse,
    onArchive: data.setArchived,
    onRemove: data.removeCourse,
    onReload: load,
  };

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary-deep">Kursverwaltung</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Auf einen Kurs klicken, um alle Angaben zu bearbeiten und neue Zeiträume anzulegen.
            Öffentliche Kurse erscheinen automatisch in der Kursübersicht der Webseite.
          </p>
        </div>
        <HeaderActions exports={exports} onNewProgram={programEditor.startNew} />
      </div>

      <ProgramCards
        programs={programs}
        counts={counts}
        termsOf={data.termsOf}
        waitingFor={data.waitingFor}
        onOpen={programEditor.openDetail}
        onNewTerm={courseEditor.startNewTerm}
      />

      <ProgramDetailDialog
        editor={programEditor}
        programs={programs}
        termsOf={data.termsOf}
        onNewTerm={courseEditor.startNewTerm}
        ctx={termContext}
      />
      <ProgramDialog
        open={programEditor.dialogOpen}
        onOpenChange={programEditor.setDialogOpen}
        editing={programEditor.editing}
        setEditing={programEditor.setEditing}
        onSave={programEditor.save}
      />
      <CourseDialog {...courseEditor.dialogProps} />
      <SessionsDialog {...sessions.dialogProps} />
      <CourseBroadcastDialog course={broadcastCourse} onClose={() => setBroadcastCourse(null)} />
      <CourseSessionsMailDialog
        course={sessionsMailCourse}
        onClose={() => setSessionsMailCourse(null)}
      />
    </div>
  );
}
