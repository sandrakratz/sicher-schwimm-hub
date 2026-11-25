import { createFileRoute } from "@tanstack/react-router";
import { WaitlistAdmin } from "@/components/admin/WaitlistAdmin";
import type { TodayView, WaitingKind } from "@/components/admin/warteliste/logic";

const VIEWS: TodayView[] = ["waiting", "offered", "followup", "declined", "done", "report"];
const KINDS: WaitingKind[] = ["now", "unmet", "later"];

export const Route = createFileRoute("/_authenticated/admin/warteliste")({
  // ?tab=archive öffnet direkt „Frühere Kursanfragen“ (Links aus Posteingang und Dashboard);
  // ?programm=<id>[,<id>] öffnet „Wartend“ gefiltert auf diese Angebote (Link aus der Kursverwaltung)
  // ?ansicht=<reiter> öffnet einen Reiter, ?grund=unmet filtert „Wartend“ (Links aus dem Eingang)
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    tab?: "archive";
    programm?: string;
    suche?: string;
    zustaendig?: "ich";
    ansicht?: TodayView;
    grund?: WaitingKind;
  } => ({
    ...(search["zustaendig"] === "ich" ? { zustaendig: "ich" as const } : {}),
    ...(VIEWS.includes(search["ansicht"] as TodayView)
      ? { ansicht: search["ansicht"] as TodayView }
      : {}),
    ...(KINDS.includes(search["grund"] as WaitingKind)
      ? { grund: search["grund"] as WaitingKind }
      : {}),
    ...(typeof search["suche"] === "string" && search["suche"].trim()
      ? { suche: search["suche"].trim().slice(0, 100) }
      : {}),
    ...(search["tab"] === "archive" ? { tab: "archive" as const } : {}),
    ...(typeof search["programm"] === "string" &&
    // „none“ = Einträge ohne Kursangebot (Link aus dem Eingang)
    /^(none|[0-9a-f-]{36}(,[0-9a-f-]{36})*)$/i.test(search["programm"])
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
  const { programm, suche, zustaendig, ansicht, grund } = Route.useSearch();
  return (
    <WaitlistAdmin
      // Neu laden, wenn der Eingang auf einen anderen Reiter/Filter verlinkt
      key={`${ansicht ?? ""}-${grund ?? ""}-${programm ?? ""}`}
      initialProgramIds={programm ? programm.split(",") : undefined}
      initialSearch={suche}
      initialMine={zustaendig === "ich"}
      initialView={ansicht}
      initialWaitingKind={grund}
    />
  );
}
