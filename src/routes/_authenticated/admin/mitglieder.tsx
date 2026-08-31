import { createFileRoute, redirect } from "@tanstack/react-router";

/** Verschoben in den Trainerbereich – alte Adresse leitet weiter. */
export const Route = createFileRoute("/_authenticated/admin/mitglieder")({
  beforeLoad: () => {
    throw redirect({ to: "/trainer/mitglieder" });
  },
  component: () => null,
});
