import { createFileRoute } from "@tanstack/react-router";
import { Kursplanung } from "@/components/admin/kursplanung/Kursplanung";

export const Route = createFileRoute("/_authenticated/admin/kursplanung")({
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
    meta: [{ title: "Kursplanung – Verwaltung" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: Kursplanung,
});
