import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/mitgliedsordnung")({
  head: () => ({
    meta: [{ title: "Mitgliedsordnung – Sicher Schwimmen e.V." }],
    links: [{ rel: "canonical", href: "https://sicher-schwimmen.com/mitgliedsordnung" }],
  }),
  component: () => (
    <LegalPage title="Mitglieds-, Beitrags- und Kursordnung">
      <p>
        Diese Ordnung fasst die für Mitglieder relevanten Regelungen aus dem Gründungshandbuch
        (Teile 3 und 6) zusammen und konkretisiert §§ 6 und 7 der Vereinssatzung.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">1. Beitragsordnung</h2>
      <p>
        Gemäß § 7 der Vereinssatzung gelten folgende jährliche Mitgliedsbeiträge. Fälligkeit
        standardmäßig jeweils am 1. März im Voraus per SEPA-Lastschrift.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="border p-3 text-left">Mitgliedsart</th>
              <th className="border p-3 text-left">Jahresbeitrag</th>
              <th className="border p-3 text-left">Zahlungsweise</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-3">Kinder &amp; Jugendliche Einzelmitgliedschaft</td>
              <td className="border p-3">60,00 €</td>
              <td className="border p-3">SEPA-Lastschrift</td>
            </tr>
            <tr>
              <td className="border p-3">Erwachsene Einzelmitglieder</td>
              <td className="border p-3">60,00 €</td>
              <td className="border p-3">SEPA-Lastschrift</td>
            </tr>
            <tr>
              <td className="border p-3">Familienbeitrag (max. 2 Erw. + alle im Haushalt lebenden Kinder)</td>
              <td className="border p-3">96,00 €</td>
              <td className="border p-3">SEPA-Lastschrift</td>
            </tr>
            <tr>
              <td className="border p-3">Fördermitglieder (Mindestbeitrag)</td>
              <td className="border p-3">ab 60,00 €</td>
              <td className="border p-3">SEPA-Lastschrift</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="font-display text-2xl font-bold text-primary-deep">2. Härtefallregelung</h2>
      <p>
        In begründeten sozialen Härtefällen kann der Vorstand auf schriftlichen Antrag den
        Mitgliedsbeitrag ganz oder teilweise stunden oder erlassen. Die Prüfung erfolgt vertraulich.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">3. Kursmodell und Gebührenstruktur</h2>
      <p>
        Der Verein unterscheidet strikt zwischen reinen Vereinsangeboten für Mitglieder
        (z. B. kostenfreies freies Üben, Familienschwimmen) und zertifizierten Kursangeboten
        (z. B. Seepferdchen-Kurse). Vereinsmitglieder erhalten einen stark vergünstigten Kurstarif,
        während Nichtmitglieder eine erhöhte, kostendeckende Kursgebühr entrichten.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">4. Eltern-Kind-Schwimmen (EKS)</h2>
      <p>
        Zur Gewährleistung der Sicherheit im Wasser sowie zur klaren und rechtssicheren
        Risikoabgrenzung des Vereins gelten für das Eltern-Kind-Schwimmen sowie die
        Kleinkind-Wassergewöhnung folgende verbindliche Sonderregelungen:
      </p>
      <ol className="list-decimal pl-5 space-y-1">
        <li>
          <strong>Keine Übertragung der primären Aufsichtspflicht:</strong> Während des gesamten
          Eltern-Kind-Angebots verbleibt die primäre Aufsichtspflicht für das Kind vollumfänglich
          und unteilbar bei der begleitenden erwachsenen Person (Elternteil oder ein von den
          Erziehungsberechtigten ausdrücklich beauftragter Erwachsener). Die Kursleitung des
          Vereins leitet das Programm methodisch an und gibt Hilfestellungen, übernimmt jedoch zu
          keinem Zeitpunkt die lückenlose Individualaufsicht über das Kind.
        </li>
        <li>
          <strong>Verbindliche Anwesenheitspflicht im Wasser:</strong> Die Begleitperson ist
          verpflichtet, während der gesamten Unterrichtseinheit gemeinsam mit dem Kind aktiv im
          Wasser zu sein. Ein Verlassen des Beckens (z. B. für Toilettengänge) ist nur gestattet,
          wenn das Kind für diesen Zeitraum ebenfalls vollständig aus dem Wasser genommen wird.
        </li>
        <li>
          <strong>Gesundheitliche Eignung:</strong> Die Erziehungsberechtigten versichern mit der
          Anmeldung, dass sowohl das Kind als auch die Begleitperson sportgesund und frei von
          ansteckenden Krankheiten (insbesondere offenen Wunden, Haut- und Ohrenerkrankungen sowie
          akuten Magen-Darm-Infekten) sind.
        </li>
        <li>
          <strong>Sicherheitsregeln im Barfußbereich:</strong> Die Begleitperson zeichnet dafür
          verantwortlich, dass das Kind außerhalb des Wassers im gesamten Nass- und Barfußbereich
          nicht rennt (akute Rutsch- und Sturzgefahr). Den Anweisungen der Kursleitung und des
          Badpersonals ist zwingend Folge zu leisten.
        </li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">5. Personelle Struktur am Beckenrand</h2>
      <p>
        Zur gezielten Förderung des eigenen Nachwuchses, zur Absicherung der Betreuungsqualität und
        zur klaren Haftungs- und Aufgabenabgrenzung definiert der Verein folgende Personalkategorien:
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="border p-3 text-left">Personalkategorie</th>
              <th className="border p-3 text-left">Mindestalter / Lizenz</th>
              <th className="border p-3 text-left">Einsatzbereich &amp; Grenzen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-3"><strong>Kursleitung (Trainer)</strong></td>
              <td className="border p-3">Mindestens 18 Jahre + Rettungsfähigkeit Silber + eFZ-Pflicht</td>
              <td className="border p-3">
                Trägt die sportliche, organisatorische und rettungsrechtliche Gesamtverantwortung
                für die Gruppe, die zugeteilte Bahn und das Lehrprogramm. Erhält eine
                Aufwandsentschädigung (Übungsleiter).
              </td>
            </tr>
            <tr>
              <td className="border p-3"><strong>Jugendhelfer</strong></td>
              <td className="border p-3">Mindestens 14 Jahre + eFZ-Pflicht</td>
              <td className="border p-3">
                Unterstützt aktiv im Wasser oder am Beckenrand (z. B. Halten von Schwimmbrettern,
                Auf- und Abbau, Motivation). Agiert unter ständiger Aufsicht der Kursleitung. Darf
                niemals allein mit einer Gruppe gelassen werden. Erhält eine Aufwandsentschädigung.
              </td>
            </tr>
            <tr>
              <td className="border p-3"><strong>Helfer in Ausbildung (HIA)</strong></td>
              <td className="border p-3">Unter 14 Jahren (z. B. 12–13 Jahre)</td>
              <td className="border p-3">
                Reine Hospitations-, Assistenz- und Lernfunktion. Darf keinerlei aktive Aufsichts-
                oder Rettungsaufgaben übernehmen, sondern lernt methodische Abläufe kennen. Dient
                der langfristigen Vereinsbindung. Nicht eigenständig haftbar.
              </td>
            </tr>
            <tr>
              <td className="border p-3"><strong>Pädagogisches Personal / Helfer</strong></td>
              <td className="border p-3">
                Mindestens 18 Jahre + pädagogische Schulung/Qualifikation + eFZ-Pflicht; kein
                Rettungsschein erforderlich
              </td>
              <td className="border p-3">
                Unterstützt die Kursleitung bei pädagogischer Begleitung, Strukturierung der
                Gruppe, Inklusion, Kommunikation mit Kindern und Sorgeberechtigten sowie bei
                situativer Deeskalation. Kann im Wasser oder am Beckenrand assistieren, übernimmt
                jedoch keine rettungsrechtliche Leitungsfunktion, ersetzt keine rettungsfähige
                Kursleitung und darf nicht alleinverantwortlich für die Wasseraufsicht oder das
                Lehrprogramm eingesetzt werden. Erhält eine Aufwandsentschädigung (Übungsleiter).
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="font-display text-2xl font-bold text-primary-deep">6. Rettungsfähigkeit</h2>
      <p>
        Bei jedem vom Verein durchgeführten Kursangebot im oder am Wasser muss mindestens eine
        anwesende und leitende Person den gültigen Nachweis der akuten Rettungsfähigkeit
        (mindestens Deutsches Rettungsschwimmabzeichen Silber, nicht älter als 2 Jahre) sowie eine
        aktuelle Erste-Hilfe-Ausbildung vorweisen. Bei parallel auf benachbarten Bahnen
        stattfindenden Kursen genügt hierfür eine gemeinsame anwesende, leitende und
        rettungsfähige Person.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">7. Vorfallsdokumentation</h2>
      <p>
        Bei besonderen Vorfällen (Unfälle, Beinahe-Ertrinken) besteht eine sofortige Dokumentations-
        und Meldepflicht an den Vorstand.
      </p>
    </LegalPage>
  ),
});
