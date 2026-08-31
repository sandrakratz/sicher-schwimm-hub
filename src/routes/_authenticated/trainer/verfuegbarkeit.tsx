import { createFileRoute } from "@tanstack/react-router";
import { AvailabilityBoard } from "@/components/trainer/AvailabilityBoard";

export const Route = createFileRoute("/_authenticated/trainer/verfuegbarkeit")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/admin-guard.functions");
    const { redirect } = await import("@tanstack/react-router");
    try { await assertHasAnyRole({ data: { roles: ["admin", "board", "trainer"] } }); }
    catch { throw redirect({ to: "/portal" }); }
  },
  head: () => ({
    meta: [
      { title: "Meine Verfügbarkeit – Trainerbereich | Sicher Schwimmen e.V." },
      { name: "description", content: "Eigene Verfügbarkeiten für Kurstermine und Helfer-Einsätze eintragen." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AvailabilityBoard,
});
