import { createFileRoute } from "@tanstack/react-router";
import { CourseRequestsAdmin } from "@/components/admin/CourseRequestsAdmin";

export const Route = createFileRoute("/_authenticated/admin/archiv")({
  // ?anfrage=<id> öffnet diese Anfrage direkt (Link aus dem Eingang der Anfrageliste)
  validateSearch: (search: Record<string, unknown>): { anfrage?: string } =>
    typeof search["anfrage"] === "string" && /^[0-9a-f-]{36}$/i.test(search["anfrage"])
      ? { anfrage: search["anfrage"] }
      : {},
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
      { title: "Frühere Kursanfragen – Verwaltung | Sicher Schwimmen e.V." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ArchivePage,
});

function ArchivePage() {
  const { anfrage } = Route.useSearch();
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
        <p className="font-semibold">Archiv – nur noch zum Nachlesen</p>
        <p className="text-muted-foreground">
          Neue Anmeldungen laufen ausschließlich über die Anfrageliste. Hier stehen die alten
          Kursanfragen sowie die automatisch erzeugten Buchungsbelege.
        </p>
      </div>
      <CourseRequestsAdmin mode="all" openId={anfrage} />
    </div>
  );
}
