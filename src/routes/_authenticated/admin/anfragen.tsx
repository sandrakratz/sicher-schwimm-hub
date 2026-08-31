import { createFileRoute } from "@tanstack/react-router";
import { CourseRequestsAdmin } from "@/components/admin/CourseRequestsAdmin";

export const Route = createFileRoute("/_authenticated/admin/anfragen")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/admin-guard.functions");
    const { redirect } = await import("@tanstack/react-router");
    try { await assertHasAnyRole({ data: { roles: ["admin", "board"] } }); }
    catch { throw redirect({ to: "/admin/benutzer" }); }
  },
  component: ArchivedRequestsPage,
});

function ArchivedRequestsPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
        <p className="font-semibold">Archiv – nur noch zum Nachlesen</p>
        <p className="text-muted-foreground">
          Neue Anmeldungen laufen ausschließlich über die Warteliste. Hier stehen die alten Kursanfragen sowie die
          automatisch erzeugten Buchungsbelege.
        </p>
      </div>
      <CourseRequestsAdmin mode="all" />
    </div>
  );
}
