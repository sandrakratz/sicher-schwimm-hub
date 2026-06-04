import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/impressum")({
  head: () => ({ meta: [{ title: "Impressum – Sicher Schwimmen e.V." }] }),
  component: () => (
    <LegalPage title="Impressum">
      <h2 className="font-display text-2xl font-bold text-primary-deep">Angaben gemäß § 5 TMG</h2>
      <p>Sicher Schwimmen e.V.<br />Hennef, Rhein-Sieg-Kreis<br />Deutschland</p>
      <p><strong>Vertreten durch:</strong> Vorstand (Platzhalter)</p>
      <p><strong>Kontakt:</strong> info@sicher-schwimmen.de</p>
      <p><strong>Vereinsregister:</strong> Eintrag folgt</p>
      <p className="text-sm text-muted-foreground">Dieser Inhalt ist ein Platzhalter und muss vor dem Live-Gang ergänzt werden.</p>
    </LegalPage>
  ),
});
