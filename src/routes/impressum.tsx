import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/impressum")({
  head: () => ({
    meta: [
      { title: "Impressum – Sicher Schwimmen e.V." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://sicher-schwimmen.com/impressum" }],
  }),
  component: () => (
    <LegalPage title="Impressum">
      <h2 className="font-display text-2xl font-bold text-primary-deep">Angaben gemäß § 5 TMG</h2>
      <p>
        Sicher Schwimmen e.V. (in Gründung)<br />
        Hennef, Rhein-Sieg-Kreis<br />
        Deutschland
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">Vertretungsberechtigter Vorstand (§ 26 BGB)</h2>
      <ul className="list-disc pl-5">
        <li>1. Vorsitzender: Michael Kratz</li>
        <li>2. Vorsitzende: Sandra Kratz</li>
        <li>Kassenwart: Manuela Scholz-Ornowski</li>
      </ul>
      <p className="text-sm text-muted-foreground">
        Der Verein wird gerichtlich und außergerichtlich durch zwei Vorstandsmitglieder gemeinsam vertreten.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">Kassenprüfung</h2>
      <p>Anja Brauer-Walbe</p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">Kontakt</h2>
      <p>E-Mail: info@sicher-schwimmen.com</p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">Vereinsregister & Steuer</h2>
      <p>
        Der Verein befindet sich derzeit in Gründung. Die Eintragung in das Vereinsregister beim
        zuständigen Amtsgericht sowie die Vergabe der Steuernummer durch das Finanzamt werden
        nach Abschluss des Gründungsverfahrens hier ergänzt.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>Der Vorstand, Anschrift wie oben.</p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">Haftung für Inhalte</h2>
      <p>
        Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich
        (§ 7 Abs. 1 TMG). Für fremde Informationen, die wir lediglich übermitteln oder speichern, sind wir nach §§ 8–10 TMG
        nicht verantwortlich.
      </p>
    </LegalPage>
  ),
});
