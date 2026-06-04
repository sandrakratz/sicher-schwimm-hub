import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/mitgliedsordnung")({
  head: () => ({ meta: [{ title: "Mitgliedsordnung – Sicher Schwimmen e.V." }] }),
  component: () => (
    <LegalPage title="Mitgliedsordnung">
      <p>Die Mitgliedsordnung regelt die Rechte und Pflichten unserer Mitglieder.</p>
      <p className="text-sm text-muted-foreground">Platzhalter – wird ergänzt.</p>
    </LegalPage>
  ),
});
