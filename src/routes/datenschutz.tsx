import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/datenschutz")({
  head: () => ({
    meta: [{ title: "Datenschutz – Sicher Schwimmen e.V." }],
    links: [{ rel: "canonical", href: "https://sicher-schwimmen.com/datenschutz" }],
  }),
  component: Page,
});

function H2({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-2xl font-bold text-primary-deep">{children}</h2>;
}

function Page() {
  return (
    <LegalPage title="Datenschutzerklärung">
      <p>
        Diese Datenschutzerklärung beruht auf der Datenschutzordnung des Vereins (Teil 5 des
        Vereinshandbuchs) und informiert über die Verarbeitung personenbezogener Daten gemäß der
        Datenschutz-Grundverordnung (DSGVO) sowie dem Bundesdatenschutzgesetz (BDSG).
      </p>

      <H2>1. Verantwortlicher</H2>
      <p>
        Sicher Schwimmen e.V., vertreten durch den Vorstand
        <br />
        c/o Michael Kratz, Bergstr. 67a
        <br />
        53773 Hennef (Rhein-Sieg-Kreis)
        <br />
        E-Mail: info@sicher-schwimmen.com
        <br />
        Telefon: 0178 / 1142945
      </p>

      <H2>2. Zwecke und Rechtsgrundlagen der Verarbeitung</H2>
      <p>
        Personenbezogene Daten werden ausschließlich zur Erfüllung der Vereinszwecke, zur
        Mitgliederverwaltung, Beitragsabrechnung und Kursorganisation verarbeitet. Rechtsgrundlagen
        sind:
      </p>
      <ul className="list-disc pl-5">
        <li>
          <strong>Art. 6 Abs. 1 lit. b DSGVO</strong> (Vertragserfüllung und vorvertragliche
          Maßnahmen): Mitgliedschaft, Kursbuchung, Warteliste, Beitragseinzug und Zahlungsabwicklung
          (einschließlich SEPA-Lastschrift).
        </li>
        <li>
          <strong>Art. 6 Abs. 1 lit. c DSGVO</strong> (rechtliche Verpflichtung): steuer- und
          handelsrechtliche Aufbewahrung von Belegen.
        </li>
        <li>
          <strong>Art. 6 Abs. 1 lit. f DSGVO</strong> (berechtigte Interessen): sicherer und
          störungsfreier Betrieb der Webseite, Abwehr von Missbrauch, Nachweis von Erklärungen (z.
          B. Widerruf), Pflege einer internen Sperrliste (siehe Ziffer 9) sowie Beantwortung von
          Anfragen.
        </li>
        <li>
          <strong>Art. 6 Abs. 1 lit. a DSGVO</strong> (Einwilligung): Push-Mitteilungen,
          Gesundheitsangaben (Art. 9 Abs. 2 lit. a DSGVO) und die Veröffentlichung von Fotos.
        </li>
      </ul>
      <p>
        <strong>Lernstand des Kindes:</strong> Die Trainerinnen und Trainer halten fest, wie viele
        Klötzchen am Schwimmgurt des Kindes zuletzt verblieben sind. Wir speichern diese Angabe bei
        der Buchung (Art. 6 Abs. 1 lit. b DSGVO) und übernehmen sie bei einer erneuten Buchung
        desselben Kindes (Abgleich über Name und Geburtsdatum) in die neue Buchung, damit das Kind
        auf dem bisherigen Stand weiterlernen kann. Sorgeberechtigte sehen den Stand im Portal unter
        „Meine Kurse“.
      </p>

      <H2>3. Besondere Kategorien (Gesundheitsdaten)</H2>
      <p>
        Gesundheitsdaten (z. B. Asthma, Epilepsie, Allergien) werden nur bei zwingender
        Erforderlichkeit für die sichere Kursdurchführung und ausschließlich mit ausdrücklicher
        Einwilligung der betroffenen Person bzw. der Sorgeberechtigten gemäß Art. 9 Abs. 2 lit. a
        DSGVO erhoben. Bei der Online-Buchung holen wir diese Einwilligung mit einem gesonderten
        Kästchen ein, sobald Sie im Feld „Gesundheitliche Hinweise“ etwas eintragen. Die Angaben
        sind <strong>freiwillig</strong>; die Einwilligung kann jederzeit mit Wirkung für die
        Zukunft widerrufen werden (info@sicher-schwimmen.com). Wir bitten, Gesundheitsangaben nicht
        in freien Textfeldern anderer Formulare (z. B. der Warteliste) zu machen.
      </p>

      <H2>4. Zugriff, Löschung und Aufbewahrung</H2>
      <p>
        Der Verein wendet den Grundsatz der Datenminimierung an. Es gelten folgende Löschfristen:
      </p>
      <ul className="list-disc pl-5">
        <li>
          <strong>Buchungs- und Zahlungsbelege (einschließlich Beitragsabrechnung):</strong> 10
          Jahre (§ 147 AO, § 257 HGB).
        </li>
        <li>
          <strong>Übrige Mitglieds- und Kursdaten:</strong> bis zu 3 Jahre nach Austritt bzw. Ablauf
          des Kursjahres (regelmäßige zivilrechtliche Verjährungsfrist), soweit keine längere
          gesetzliche Aufbewahrungspflicht besteht.
        </li>
        <li>
          <strong>Gesundheits- und Notfalldaten:</strong> sichere Archivierung nach Kursende;
          Löschung nach Ablauf der regelmäßigen zivilrechtlichen Verjährungsfrist (i. d. R. 3 Jahre
          nach Ablauf des Kursjahres), bei Widerruf der Einwilligung früher.
        </li>
        <li>
          <strong>Lernstand (Klötzchen am Schwimmgurt):</strong> 3 Jahre nach Ablauf des Kursjahres,
          dann wird die Angabe automatisch gelöscht.
        </li>
        <li>
          <strong>Widerrufe und Versandprotokolle:</strong> in der Regel 3 Jahre.
        </li>
        <li>
          <strong>Vorfallsdokumentation:</strong> Aufbewahrung gemäß Vorgaben der
          Berufsgenossenschaft bzw. Versicherung.
        </li>
      </ul>

      <H2>5. Empfänger, Auftragsverarbeiter und Drittländer</H2>
      <p>
        Für Betrieb und Verwaltung dieser Webseite setzen wir Dienstleister ein, mit denen wir –
        soweit erforderlich – Verträge zur Auftragsverarbeitung nach Art. 28 DSGVO geschlossen
        haben:
      </p>
      <ul className="list-disc pl-5">
        <li>
          <strong>Supabase, Inc.</strong> – Datenbank, Anmeldung und Dateispeicher. Die Daten liegen
          in Rechenzentren in Frankfurt am Main (EU).
        </li>
        <li>
          <strong>Cloudflare, Inc.</strong> – Auslieferung und Ausführung der Webseite,
          Domain-Namensdienst, Schutz vor Missbrauch.
        </li>
        <li>
          <strong>Resend</strong> (Resend, Inc.) – Versand von E-Mails. Empfängeradresse, Betreff
          und Inhalt der jeweiligen E-Mail werden dort verarbeitet.
        </li>
        <li>
          <strong>One.com A/S</strong> (Dänemark) – Domain und E-Mail-Postfächer des Vereins.
        </li>
      </ul>
      <p>
        Supabase, Cloudflare und Resend haben ihren Sitz in den USA. Eine Übermittlung dorthin
        stützt sich auf den Angemessenheitsbeschluss der EU-Kommission zum EU-US-Datenschutzrahmen
        (Art. 45 DSGVO), soweit der Anbieter dort zertifiziert ist, und im Übrigen auf
        EU-Standardvertragsklauseln (Art. 46 DSGVO). Eine Kopie der Garantien erhalten Sie auf
        Anfrage.
      </p>
      <p>
        Darüber hinaus geben wir Daten nur weiter, soweit dies zur Vertragserfüllung (z. B.
        Kreditinstitut für den Beitragseinzug), aufgrund einer gesetzlichen Pflicht oder mit Ihrer
        Einwilligung erfolgt.
      </p>

      <H2>6. Hosting, Server-Logfiles und Schriftarten</H2>
      <p>
        Beim Aufruf der Seiten verarbeitet Cloudflare automatisch technische Zugriffsdaten (u. a.
        IP-Adresse, Datum und Uhrzeit, abgerufene Seite, Browsertyp), die für den sicheren und
        störungsfreien Betrieb erforderlich sind. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO
        (berechtigtes Interesse an einem sicheren Betrieb). Die Übertragung erfolgt verschlüsselt
        (TLS/HTTPS). Die auf der Webseite verwendeten Schriftarten werden von unserem eigenen Server
        ausgeliefert; es findet dafür <strong>keine Verbindung zu Google</strong> statt.
      </p>

      <H2>7. Formulare, Benutzerkonto & E-Mail-Versand</H2>
      <p>
        Bei Kontakt-, Kursanfrage-, Kursbuchungs-, Mitgliedsantrags-, Warteliste- und
        Widerrufsformularen verarbeiten wir die von Ihnen eingegebenen Daten ausschließlich zur
        Bearbeitung Ihres Anliegens (Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO). Beim Widerruf
        speichern wir zur Nachvollziehbarkeit zusätzlich Ihre IP-Adresse, die Browserkennung und den
        Zeitpunkt. Für den Mitglieder- und Kursbereich legen wir ein Benutzerkonto mit
        E-Mail-Adresse, Namen und Rolle an; unser Anmeldedienst (Supabase) protokolliert dabei
        technische Anmeldedaten einschließlich der IP-Adresse.
      </p>
      <p>
        Zur Bestätigung, Terminabstimmung, Zahlungserinnerung und Beantwortung Ihrer Anfragen
        versenden wir E-Mails über Resend. Versandzeitpunkt, Empfänger, Betreff, Zustellstatus und
        Inhalt werden zu Nachweiszwecken in unserer Datenbank protokolliert. Adressen, bei denen
        eine Zustellung dauerhaft scheitert oder die sich abgemeldet haben, setzen wir auf eine
        Sperrliste, damit keine weiteren E-Mails versandt werden. Informationsmails können jederzeit
        über den Abmeldelink abbestellt werden.
      </p>
      <p>
        Die Angabe der in den Formularen als Pflichtfelder gekennzeichneten Daten ist für Buchung
        bzw. Mitgliedschaft erforderlich; ohne diese Angaben können wir den Vertrag nicht schließen.
        Die Daten der Kinder erhalten wir von den Eltern bzw. Sorgeberechtigten.
      </p>

      <H2>8. Push-Mitteilungen</H2>
      <p>
        Wenn Sie über den Link in Ihrer Buchungsbestätigung „Mitteilungen aktivieren“, speichern wir
        die Adresse Ihres Geräts bei dem Push-Dienst Ihres Browsers (Google, Apple oder Mozilla),
        die dazugehörigen Schlüssel, die Browserkennung und die Zuordnung zu Ihrer Buchung. Wir
        senden darüber Eilnachrichten zu Ihrem Kurs (z. B. Ausfall). Rechtsgrundlage ist Ihre
        Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG). Der Inhalt der Mitteilungen
        wird verschlüsselt übertragen. Sie können die Mitteilungen jederzeit auf derselben Seite
        oder in den Einstellungen Ihres Browsers abschalten; wir löschen das Abonnement dann.
      </p>

      <H2>9. Interne Sperrliste</H2>
      <p>
        Zur Vermeidung wiederholter Fehlbuchungen und zum Schutz der Kursabläufe führen wir eine
        interne Sperrliste (Name und Geburtsdatum des Kindes, E-Mail-Adresse, Grund; Zugriff nur für
        den Vorstand). Eine Buchung trotz Eintrags ist nicht automatisch ausgeschlossen: Der
        Vorstand prüft solche Anfragen im Einzelfall. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f
        DSGVO. Einträge werden spätestens nach zwei Jahren überprüft und gelöscht, wenn sie nicht
        mehr erforderlich sind.
      </p>

      <H2>10. Trainer, Helfer und Ehrenamtliche</H2>
      <p>
        Für Trainer*innen, Helfer*innen und Ehrenamtliche verarbeiten wir Kontaktdaten, Konto und
        Rolle, Verfügbarkeiten, Dienstplan und Anwesenheit zur Organisation des Kursbetriebs (Art. 6
        Abs. 1 lit. b DSGVO, § 26 BDSG). Trainer*innen können zudem eine Bankverbindung (IBAN,
        Kontoinhaber*in) für die Auszahlung der Übungsleitergelder hinterlegen; diese ist nur für
        sie selbst und den Vorstand sichtbar. Erweiterte Führungszeugnisse werden ausschließlich zur
        Erfüllung der Pflichten nach § 72a SGB VIII im Rahmen unseres Kinderschutzkonzepts
        verarbeitet.
      </p>

      <H2>11. Cookies, Browser-Speicher & Reichweitenmessung</H2>
      <p>
        Diese Webseite setzt <strong>keine Cookies</strong>. Beim Anmelden speichert Ihr Browser
        eine Sitzungskennung im lokalen Speicher; im Mitglieder- und Verwaltungsbereich merken wir
        uns außerdem Einstellungen der Oberfläche (z. B. aufgeklappte Bereiche). Beides ist für den
        Betrieb erforderlich und verlässt Ihr Gerät nicht (§ 25 Abs. 2 TDDDG). Tracking-, Werbe-
        oder Analysedienste Dritter werden nicht eingesetzt. Ein Cookie-Banner ist deshalb nicht
        erforderlich.
      </p>

      <H2>12. Bildnutzung, Soziale Netzwerke & externe Links</H2>
      <p>
        Die Veröffentlichung von Fotos im Internet oder in Printmedien erfolgt nur nach vorheriger
        Einwilligung oder auf einer anderweitig tragfähigen Rechtsgrundlage. Einige Bilder dieser
        Webseite sind KI-generiert (siehe Impressum, Bildnachweise). Wir verlinken auf unsere Seiten
        bei Facebook und Instagram (Meta) sowie auf Seiten Dritter; beim bloßen Aufruf unserer
        Webseite werden dabei keine Daten an diese übertragen. Für den Betrieb unserer Seiten bei
        Meta besteht eine gemeinsame Verantwortlichkeit mit Meta; Näheres regeln die
        Datenschutzhinweise von Meta.
      </p>

      <H2>13. Ihre Rechte</H2>
      <p>
        Betroffene haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art.
        17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) sowie auf
        Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO).
      </p>
      <p>
        <strong>Widerspruchsrecht:</strong> Soweit wir Daten auf Grundlage berechtigter Interessen
        (Art. 6 Abs. 1 lit. f DSGVO) verarbeiten, können Sie aus Gründen, die sich aus Ihrer
        besonderen Situation ergeben, jederzeit Widerspruch einlegen (Art. 21 DSGVO).
      </p>
      <p>
        Es besteht ein Beschwerderecht bei der zuständigen Aufsichtsbehörde: Landesbeauftragte für
        Datenschutz und Informationsfreiheit Nordrhein-Westfalen (LDI NRW), Kavalleriestr. 2–4,
        40213 Düsseldorf.
      </p>
      <p>Eine automatisierte Entscheidungsfindung einschließlich Profiling findet nicht statt.</p>

      <H2>14. Technisch-organisatorische Maßnahmen (TOMs)</H2>
      <p>
        Der Verein schützt personenbezogene Daten durch angemessene technisch-organisatorische
        Maßnahmen: rollenbasierte Zugriffsberechtigungen, verschlüsselte Speicherung digitaler
        Unterlagen, sichere Übermittlungswege, abschließbare Aufbewahrung analoger Unterlagen sowie
        dokumentierte Berechtigungskonzepte.
      </p>

      <H2>15. Datenschutzkontakt</H2>
      <p>
        Datenschutzanfragen richten Sie bitte an den Vorstand unter info@sicher-schwimmen.com.
        Sollte gesetzlich die Pflicht zur Benennung eines Datenschutzbeauftragten bestehen, wird
        dieser gesondert benannt.
      </p>

      <p className="text-sm text-muted-foreground">Stand: Oktober 2026</p>
    </LegalPage>
  );
}
