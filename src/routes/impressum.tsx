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
      <h2 className="font-display text-2xl font-bold text-primary-deep">Angaben gemäß § 5 DDG</h2>
      <p>
        Sicher Schwimmen e.V.<br />
        c/o Michael Kratz<br />
        Bergstr. 67a<br />
        53773 Hennef (Rhein-Sieg-Kreis)<br />
        Deutschland
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">Vertretungsberechtigter Vorstand (§ 26 BGB)</h2>
      <ul className="list-disc pl-5">
        <li>1. Vorsitzender: Michael Kratz, Bergstr. 67a, 53773 Hennef</li>
        <li>2. Vorsitzende: Sandra Kratz</li>
        <li>Kassenwart: Manuela Scholz-Ornowski</li>
      </ul>
      <p className="text-sm text-muted-foreground">
        Der Verein wird gerichtlich und außergerichtlich durch zwei Vorstandsmitglieder gemeinsam vertreten.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">Kassenprüfung</h2>
      <p>Anja Brauer-Walbe</p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">Kontakt</h2>
      <p>
        E-Mail: <a href="mailto:info@sicher-schwimmen.com" className="text-primary underline">info@sicher-schwimmen.com</a><br />
        Telefon: 0178 / 1142945
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">Vereinsregister</h2>
      <p>
        Registergericht: Amtsgericht Siegburg<br />
        Registernummer: VR 4149
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>Michael Kratz, Bergstr. 67a, 53773 Hennef</p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">Verbraucherstreitbeilegung</h2>
      <p>
        Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen (§ 36 VSBG).
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">Haftung für Inhalte</h2>
      <p>
        Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich
        (§ 7 Abs. 1 DDG). Für fremde Informationen, die wir lediglich übermitteln oder speichern, sind wir nach
        §§ 8–10 DDG nicht verantwortlich.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">Haftung für Links</h2>
      <p>
        Unser Angebot enthält ggf. Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen Einfluss haben.
        Für diese fremden Inhalte ist stets der jeweilige Anbieter verantwortlich. Bei Bekanntwerden von
        Rechtsverletzungen entfernen wir derartige Links umgehend.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">Urheberrecht</h2>
      <p>
        Die durch den Verein erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht.
        Eine Vervielfältigung, Bearbeitung oder Verbreitung außerhalb der Grenzen des Urheberrechts bedarf der
        schriftlichen Zustimmung des Vereins.
      </p>

      <h2 id="bildnachweise" className="scroll-mt-24 font-display text-2xl font-bold text-primary-deep">Bildnachweise</h2>
      <p>
        Ein Teil der auf dieser Website verwendeten Bilder wurde mit Hilfe künstlicher Intelligenz (KI) erstellt.
        Diese Abbildungen dienen ausschließlich der Illustration und zeigen keine realen Personen, Veranstaltungen
        oder Kursorte des Vereins.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">Widerrufsrecht</h2>
      <p>
        Informationen zum Widerrufsrecht sowie das Muster-Widerrufsformular finden Sie unter{" "}
        <a href="/widerruf" className="text-primary underline">Widerruf</a>.
      </p>


      <p className="text-sm text-muted-foreground">Stand: Juli 2026</p>
    </LegalPage>
  ),
});
