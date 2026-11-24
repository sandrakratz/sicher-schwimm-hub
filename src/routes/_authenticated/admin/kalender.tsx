import { createFileRoute, redirect } from "@tanstack/react-router";

// Die frühere Seite „Kurse & Termine“ ist im Dienstplan aufgegangen (Reiter „Kurs einteilen“ und
// „Vereinstermine & Helfer“). Alte Links – auch ?kurs=<id> aus der Kursverwaltung – führen dorthin.
export const Route = createFileRoute("/_authenticated/admin/kalender")({
  validateSearch: (search: Record<string, unknown>): { kurs?: string } =>
    typeof search["kurs"] === "string" && search["kurs"] ? { kurs: search["kurs"] } : {},
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/admin/dienstplan",
      search: { tab: "einteilen", ...(search.kurs ? { kurs: search.kurs } : {}) },
    });
  },
});
