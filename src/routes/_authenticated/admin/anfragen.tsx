import { createFileRoute, redirect } from "@tanstack/react-router";

/** Zusammengelegt: Kursanfragen sind jetzt ein Reiter auf der Wartelisten-Seite. */
export const Route = createFileRoute("/_authenticated/admin/anfragen")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/warteliste" });
  },
  component: () => null,
});
