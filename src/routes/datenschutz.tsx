import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/datenschutz")({
  head: () => ({
    meta: [
      { title: "Datenschutz – Sicher Schwimmen e.V." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://sicher-schwimmen.com/datenschutz" }],
  }),
  component: () => (
    <LegalPage title="Datenschutzerklärung">
      <p>
        Diese Datenschutzerklärung beruht auf der Datenschutzordnung des Vereins (Teil 5 des
        Gründungshandbuchs) und informiert über die Verarbeitung personenbezogener Daten gemäß
        der Datenschutz-Grundverordnung (DSGVO) sowie dem Bundesdatenschutzgesetz (BDSG).
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">1. Verantwortlicher</h2>
      <p>
        Sicher Schwimmen e.V. (in Gründung), vertreten durch den Vorstand<br />
        Hennef, Rhein-Sieg-Kreis<br />
        E-Mail: info@sicher-schwimmen.com
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">2. Zwecke und Rechtsgrundlagen der Verarbeitung</h2>
      <p>
        Personenbezogene Daten werden ausschließlich zur Erfüllung der Vereinszwecke, zur
        Mitgliederverwaltung, Beitragsabrechnung und Kursorganisation verarbeitet.
        Rechtsgrundlage ist die Vertragserfüllung gemäß Art. 6 Abs. 1 lit. b DSGVO sowie ein
        berechtigtes Interesse nach Art. 6 Abs. 1 lit. f DSGVO. Für die SEPA-Lastschrift gilt
        zusätzlich Art. 6 Abs. 1 lit. b DSGVO (Beitragsordnung).
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">3. Besondere Kategorien (Gesundheitsdaten)</h2>
      <p>
        Gesundheitsdaten (z. B. Asthma, Epilepsie, Allergien) werden nur bei zwingender
        Erforderlichkeit für die sichere Kursdurchführung und ausschließlich mit ausdrücklicher,
        schriftlicher Einwilligung der betroffenen Person bzw. der Sorgeberechtigten gemäß
        Art. 9 Abs. 2 lit. a DSGVO erhoben.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">4. Zugriff, Löschung und Aufbewahrung</h2>
      <p>
        Der Verein wendet den Grundsatz der Datenminimierung an. Es gelten folgende Löschfristen:
      </p>
      <ul className="list-disc pl-5">
        <li><strong>Mitglieds- und Buchungsdaten:</strong> bis zu 10 Jahre nach Austritt (steuerliche Aufbewahrungsfristen).</li>
        <li><strong>Gesundheits- und Notfalldaten:</strong> sichere Archivierung nach Kursende; Löschung nach Ablauf der regelmäßigen zivilrechtlichen Verjährungsfrist (i. d. R. 3 Jahre nach Ablauf des Kursjahres).</li>
        <li><strong>Vorfallsdokumentation:</strong> Aufbewahrung gemäß Vorgaben der Berufsgenossenschaft bzw. Versicherung.</li>
      </ul>

      <h2 className="font-display text-2xl font-bold text-primary-deep">5. Bildnutzung & Betroffenenrechte</h2>
      <p>
        Die Veröffentlichung von Fotos im Internet oder in Printmedien erfolgt nur nach vorheriger
        Einwilligung oder auf einer anderweitig tragfähigen Rechtsgrundlage. Betroffene haben
        insbesondere das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
        Datenübertragbarkeit sowie Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft.
        Es besteht ein Beschwerderecht bei der zuständigen Aufsichtsbehörde.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">6. Technisch-organisatorische Maßnahmen (TOMs)</h2>
      <p>
        Der Verein schützt personenbezogene Daten durch angemessene technisch-organisatorische
        Maßnahmen: rollenbasierte Zugriffsberechtigungen, verschlüsselte Speicherung digitaler
        Unterlagen, sichere Übermittlungswege, abschließbare Aufbewahrung analoger Unterlagen sowie
        dokumentierte Berechtigungskonzepte.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">7. Auftragsverarbeitung & externe Dienstleister</h2>
      <p>
        Sofern der Verein externe Software, Cloud-Dienste, Buchungs- oder Kommunikationssysteme
        einsetzt, geschieht dies nur auf Basis einer datenschutzrechtlich tragfähigen Grundlage und –
        soweit erforderlich – unter Abschluss eines Vertrages zur Auftragsverarbeitung gemäß Art. 28 DSGVO.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">8. Datenschutzkontakt</h2>
      <p>
        Datenschutzanfragen richten Sie bitte an den Vorstand unter info@sicher-schwimmen.com.
        Sollte gesetzlich die Pflicht zur Benennung eines Datenschutzbeauftragten bestehen, wird
        dieser gesondert benannt.
      </p>
    </LegalPage>
  ),
});
