import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CourseDialog } from "@/components/admin/kurse/CourseDialog";
import { HeaderActions } from "@/components/admin/kurse/HeaderActions";
import { ProgramCards } from "@/components/admin/kurse/ProgramCards";
import { ProgramDialog } from "@/components/admin/kurse/ProgramDialog";
import { useCourseData } from "@/components/admin/kurse/useCourseData";
import { useCourseEditor } from "@/components/admin/kurse/useCourseEditor";
import { useCourseExports } from "@/components/admin/kurse/useCourseExports";
import { useProgramEditor } from "@/components/admin/kurse/useProgramEditor";

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

/**
 * Kursverwaltung: Übersicht der Kursangebote. Ein Klick öffnet die Seite des Angebots
 * (Kurszeiträume, Kursangaben), von dort führt „Teilnehmer“ zur Seite des Zeitraums.
 */
function Page() {
  const data = useCourseData();
  const { programs, counts, load } = data;
  const exports = useCourseExports();
  const programEditor = useProgramEditor(programs, load);
  const courseEditor = useCourseEditor(load, programs);
  const navigate = useNavigate();

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
        onOpen={(p) =>
          void navigate({
            to: "/admin/kursangebot/$programId",
            params: { programId: p ? p.id : "ohne" },
          })
        }
        onNewTerm={courseEditor.startNewTerm}
      />

      <ProgramDialog
        open={programEditor.dialogOpen}
        onOpenChange={programEditor.setDialogOpen}
        editing={programEditor.editing}
        setEditing={programEditor.setEditing}
        onSave={programEditor.save}
      />
      <CourseDialog {...courseEditor.dialogProps} />
    </div>
  );
}
