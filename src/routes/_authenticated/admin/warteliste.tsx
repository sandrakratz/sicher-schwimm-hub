import { createFileRoute } from "@tanstack/react-router";
import { WaitlistAdmin } from "@/components/admin/WaitlistAdmin";

export const Route = createFileRoute("/_authenticated/admin/warteliste")({
  // ?tab=archive öffnet direkt „Frühere Kursanfragen“ (Links aus Posteingang und Dashboard);
  // ?programm=<id>[,<id>] öffnet „Wartend“ gefiltert auf diese Angebote (Link aus der Kursverwaltung)
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: "archive"; programm?: string; suche?: string; zustaendig?: "ich" } => ({
    ...(search["zustaendig"] === "ich" ? { zustaendig: "ich" as const } : {}),
    ...(typeof search["suche"] === "string" && search["suche"].trim()
      ? { suche: search["suche"].trim().slice(0, 100) }
      : {}),
    ...(search["tab"] === "archive" ? { tab: "archive" as const } : {}),
    ...(typeof search["programm"] === "string" &&
    /^[0-9a-f-]{36}(,[0-9a-f-]{36})*$/i.test(search["programm"])
      ? { programm: search["programm"] }
      : {}),
  }),
  beforeLoad: async ({ search }) => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    // Alte Adresse ?tab=archive → eigener Reiter „Frühere Kursanfragen“
    if (search.tab === "archive") throw redirect({ to: "/admin/archiv" });
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board"] } });
    } catch {
      throw redirect({ to: "/admin/benutzer" });
    }
  },
  component: WaitlistPage,
});

function WaitlistPage() {
  const { programm, suche, zustaendig } = Route.useSearch();
  return (
    <WaitlistAdmin
      initialProgramIds={programm ? programm.split(",") : undefined}
      initialSearch={suche}
      initialMine={zustaendig === "ich"}
    />
  );
}
