import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/satzung")({
  head: () => ({ meta: [{ title: "Vereinssatzung – Sicher Schwimmen e.V." }] }),
  component: () => (
    <LegalPage title="Vereinssatzung">
      <p>Die aktuelle Vereinssatzung steht Mitgliedern im internen Portal als Download zur Verfügung.</p>
      <p className="text-sm text-muted-foreground">Platzhalter – die finale Satzung wird in Kürze veröffentlicht.</p>
    </LegalPage>
  ),
});
