import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/datenschutz")({
  head: () => ({ meta: [{ title: "Datenschutz – Sicher Schwimmen e.V." }] }),
  component: () => (
    <LegalPage title="Datenschutzerklärung">
      <p>Wir erheben und verarbeiten personenbezogene Daten nur im Rahmen der gesetzlichen Bestimmungen (DSGVO, BDSG).</p>
      <h2 className="font-display text-2xl font-bold text-primary-deep">Verantwortlicher</h2>
      <p>Sicher Schwimmen e.V., Hennef – info@sicher-schwimmen.com</p>
      <h2 className="font-display text-2xl font-bold text-primary-deep">Zwecke der Verarbeitung</h2>
      <ul className="list-disc pl-5"><li>Bearbeitung von Kursanfragen</li><li>Verwaltung der Mitgliedschaft</li><li>Kommunikation mit Mitgliedern</li></ul>
      <h2 className="font-display text-2xl font-bold text-primary-deep">Ihre Rechte</h2>
      <p>Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch und Beschwerde bei der Aufsichtsbehörde.</p>
      <p className="text-sm text-muted-foreground">Platzhaltertext – vollständige Erklärung wird ergänzt.</p>
    </LegalPage>
  ),
});
