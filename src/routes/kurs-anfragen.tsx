import { createFileRoute, redirect } from "@tanstack/react-router";

// Das alte Kursanfrage-Formular wurde durch das Wartelistensystem abgelöst.
// Bestehende Links und Lesezeichen führen dauerhaft auf /warteliste.
export const Route = createFileRoute("/kurs-anfragen")({
  beforeLoad: () => {
    throw redirect({ to: "/warteliste" });
  },
});
