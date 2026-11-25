import { createFileRoute, redirect } from "@tanstack/react-router";

// Der Versandstatus ist in „Gesendete E-Mails“ aufgegangen (Filter „Nur Probleme“).
// Alte Lesezeichen und Links landen dort.
export const Route = createFileRoute("/_authenticated/admin/versandstatus")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/emails", search: { status: "problems" } });
  },
});
