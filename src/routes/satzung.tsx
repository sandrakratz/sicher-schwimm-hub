import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/satzung")({
  head: () => ({
    meta: [{ title: "Vereinssatzung – Sicher Schwimmen e.V." }],
    links: [{ rel: "canonical", href: "https://sicher-schwimmen.com/satzung" }],
  }),
  component: () => (
    <LegalPage title="Vereinssatzung">
      <p className="text-sm text-muted-foreground">
        Endfassung gemäß Gründungshandbuch. Die Satzung tritt mit Eintragung in das Vereinsregister in Kraft.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 1 Name, Sitz, Geschäftsjahr</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Der Verein führt den Namen „Sicher Schwimmen e. V.".</li>
        <li>Der Verein hat seinen Sitz in Hennef im Rhein-Sieg-Kreis.</li>
        <li>Der Verein soll in das Vereinsregister beim zuständigen Amtsgericht eingetragen werden.</li>
        <li>Das Geschäftsjahr des Vereins ist das Kalenderjahr.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 2 Zweck des Vereins, Gemeinnützigkeit</h2>
      <ol className="list-decimal pl-5 space-y-2">
        <li>
          Zweck des Vereins ist die Förderung des Sports, insbesondere der Schwimmausbildung, der
          Wassersicherheit, der Bewegungsförderung im Wasser sowie gesundheitsorientierter
          Bewegungsangebote für Kinder, Jugendliche und Erwachsene, sowie die Förderung der
          Jugendhilfe durch präventive und integrative Maßnahmen.
        </li>
        <li>
          Der Satzungszweck wird insbesondere verwirklicht durch:
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              die systematische Durchführung von zielgruppenspezifischen Schwimmkursen
              (Wassergewöhnung, Seepferdchen, Jugendschwimmabzeichen Bronze, Silber, Gold,
              Erwachsenenschwimmen);
            </li>
            <li>
              die Konzeption und Organisation von Ferienintensivkursen zur nachhaltigen
              Beschleunigung des Schwimmkompetenzerwerbs;
            </li>
            <li>
              die Bereitstellung von Familienangeboten wie Eltern-Kind-Schwimmen,
              Familienschwimmen und offenen Wasserzeiten zur nachhaltigen Bewegungsförderung im
              familiären Kontext;
            </li>
            <li>
              die Durchführung von gesundheitsorientierten Kursen (Aquafitness, Wassergymnastik,
              Präventionskurse);
            </li>
            <li>
              die gezielte Förderung der Inklusion durch spezialisierte Angebote für Kinder und
              Jugendliche mit Förderbedarf sowie eine individuelle Begleitung im Wasser;
            </li>
            <li>
              die kontinuierliche Aus- und Fortbildung von Trainern, Übungsleitern,
              Rettungsschwimmern und Assistenten zur Gewährleistung eines dauerhaft hohen
              Qualifikations- und Sicherheitsniveaus.
            </li>
          </ul>
        </li>
        <li>
          Der Verein verfolgt ausschließlich und unmittelbar gemeinnützige Zwecke im Sinne des
          Abschnitts „Steuerbegünstigte Zwecke" der Abgabenordnung (AO).
        </li>
        <li>Der Verein ist selbstlos tätig; er verfolgt nicht in erster Linie eigenwirtschaftliche Zwecke.</li>
        <li>
          Mittel des Vereins dürfen nur für die satzungsmäßigen Zwecke verwendet werden. Die
          Mitglieder erhalten keine Zuwendungen aus Mitteln des Vereins. Es darf keine Person
          durch Ausgaben, die dem Zweck des Vereins fremd sind, oder durch unverhältnismäßig hohe
          Vergütungen begünstigt werden.
        </li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 3 Erwerb der Mitgliedschaft</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Mitglied des Vereins kann jede natürliche oder juristische Person werden, welche die Ziele des Vereins unterstützt.</li>
        <li>Der Antrag auf Aufnahme in den Verein hat schriftlich oder in Textform zu erfolgen. Bei Minderjährigen ist der Aufnahmeantrag durch die gesetzlichen Vertreter zu unterzeichnen bzw. zu stellen.</li>
        <li>Über die Aufnahme entscheidet der Vorstand nach freiem Ermessen. Ein Aufnahmeanspruch besteht nicht. Eine Ablehnung muss nicht begründet werden.</li>
        <li>Die Mitgliedschaft beginnt mit dem Zugang der schriftlichen Aufnahmebestätigung.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 4 Arten der Mitgliedschaft</h2>
      <p>Der Verein unterscheidet folgende Arten von Mitgliedern:</p>
      <ol className="list-decimal pl-5 space-y-1">
        <li><strong>Ordentliche Mitglieder (Kinder/Jugendliche):</strong> Mitglieder bis zur Vollendung des 18. Lebensjahres, rechtlich vertreten durch ihre gesetzlichen Vertreter.</li>
        <li><strong>Ordentliche Mitglieder (Erwachsene):</strong> Mitglieder ab der Vollendung des 18. Lebensjahres mit vollem aktivem Stimm- und Wahlrecht.</li>
        <li><strong>Familienmitglieder:</strong> Zusammenfassende Mitgliedschaft für bis zu zwei Erwachsene und alle im selben Haushalt lebenden Kinder/Jugendliche bis zum 18. Lebensjahr. Jedes volljährige Familienmitglied besitzt eine eigenständige Stimme.</li>
        <li><strong>Fördermitglieder:</strong> Natürliche oder juristische Personen, die den Verein ideell oder finanziell unterstützen. Fördermitglieder haben ein Mitsprache- und Antragsrecht, jedoch kein aktives oder passives Stimm- und Wahlrecht in der Mitgliederversammlung.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 5 Beendigung der Mitgliedschaft</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Die Mitgliedschaft endet durch Tod, Austritt, Ausschluss aus dem Verein oder Löschung der juristischen Person.</li>
        <li>Der Austritt erfolgt durch schriftliche Erklärung gegenüber dem Vorstand. Er ist unter Einhaltung einer Frist von sechs Wochen zum Ende eines Kalenderjahres zulässig.</li>
        <li>Ein Mitglied kann durch Beschluss des Vorstands aus dem Verein ausgeschlossen werden, wenn es grob gegen die Vereinsinteressen oder die Satzung verstoßen hat oder mit der Zahlung von Mitgliedsbeiträgen trotz zweimaliger schriftlicher Mahnung mehr als sechs Monate im Rückstand ist. Vor der Beschlussfassung ist dem Mitglied Gelegenheit zur Stellungnahme zu geben.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 6 Rechte und Pflichten der Mitglieder</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Alle Mitglieder haben das Recht, die Angebote des Vereins im Rahmen der bestehenden Ordnungen, Sicherheitsvorgaben und Hallenkapazitäten zu nutzen.</li>
        <li>Die Mitglieder sind verpflichtet, die Ziele des Vereins aktiv zu fördern, die Satzung und Ordnungen zu beachten sowie die festgesetzten Beiträge pünktlich zu entrichten.</li>
        <li>Alle Personen, die im Auftrag des Vereins mit Kindern und Jugendlichen arbeiten, verpflichten sich zur strikten Einhaltung der Kinderschutzordnung und des Verhaltenskodexes.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 7 Mitgliedsbeiträge und Finanzen</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Von den Mitgliedern werden jährliche Beiträge erhoben. Zur Finanzierung besonderer Vorhaben oder bei Liquiditätsengpässen können von der Mitgliederversammlung Sonderumlagen beschlossen werden, die das Dreifache eines Jahresbeitrags nicht übersteigen dürfen.</li>
        <li>Die Höhe der Beiträge, deren Fälligkeit sowie eventuelle Aufnahmegebühren werden in einer separaten Beitragsordnung geregelt, die von der Mitgliederversammlung mit einfacher Mehrheit beschlossen wird.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 8 Organe des Vereins</h2>
      <p>Die Organe des Vereins sind die Mitgliederversammlung und der Vorstand.</p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 9 Die Mitgliederversammlung</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Die Mitgliederversammlung ist das oberste Beschlussorgan des Vereins. Sie ist mindestens einmal jährlich durchzuführen (ordentliche Mitgliederversammlung).</li>
        <li>Die Einberufung erfolgt durch den Vorstand in Textform unter Einhaltung einer Frist von mindestens zwei Wochen und unter gleichzeitiger Bekanntgabe der Tagesordnung.</li>
        <li>Jede ordnungsgemäß einberufene Mitgliederversammlung ist ohne Rücksicht auf die Anzahl der erschienenen Mitglieder beschlussfähig. Sie fasst ihre Beschlüsse mit einfacher Mehrheit der abgegebenen gültigen Stimmen. Für Satzungsänderungen und Zweckänderungen ist eine Mehrheit von drei Vierteln der abgegebenen gültigen Stimmen erforderlich.</li>
        <li>Über die Beschlüsse der Mitgliederversammlung ist ein Ergebnisprotokoll anzufertigen, das vom Versammlungsleiter und vom Protokollführer zu unterzeichnen ist.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 10 Der Vorstand</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Der Vorstand im Sinne des § 26 BGB besteht aus dem/der 1. Vorsitzenden, dem/der 2. Vorsitzenden und dem/der Kassenwart/in.</li>
        <li>Der Verein wird gerichtlich und außergerichtlich durch zwei Mitglieder des Vorstands gemeinsam vertreten (Gemeinschaftsvertretung).</li>
        <li>Die Vorstandsmitglieder werden von der Mitgliederversammlung für die Dauer von zwei Jahren gewählt. Sie bleiben bis zur wirksamen Neuwahl im Amt.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 11 Vereinsordnungen</h2>
      <p>
        Der Vorstand ist ermächtigt, zur Regelung der internen Vereinsabläufe spezifische Ordnungen
        (Beitrags-, Kinderschutz-, Datenschutz-, Ehrenamts- und Kursordnung) zu erlassen, sofern diese
        nicht der Satzung widersprechen. Die Beitragsordnung bedarf zwingend der Genehmigung durch
        die Mitgliederversammlung.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 12 Vergütung der Vereinstätigkeit, Aufwandsersatz</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Die Vereins- und Organämter werden grundsätzlich ehrenamtlich ausgeübt.</li>
        <li>Bei Bedarf können Vereins- und Organämter im Rahmen der finanziellen Möglichkeiten des Vereins auf Grundlage eines Dienstvertrages oder gegen Zahlung einer Aufwandsentschädigung nach § 3 Nr. 26a EStG (Ehrenamtspauschale) ausgeübt werden.</li>
        <li>Die Zahlung von Vergütungen an Trainer und Helfer im Rahmen der Übungsleiterpauschale (§ 3 Nr. 26 EStG) oder der Ehrenamtspauschale ist ausdrücklich zulässig.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 13 Kassenprüfung</h2>
      <p>
        Die Mitgliederversammlung wählt für die Dauer von zwei Jahren einen Kassenprüfer, der nicht
        dem Vorstand angehört. Der Kassenprüfer prüft mindestens einmal jährlich die Buchführung
        und Kassenlage des Vereins. Über das Ergebnis der Prüfung berichtet er der Mitgliederversammlung.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 14 Kinderschutzgarantie und Prävention</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Der Verein verpflichtet sich, das Wohl von Kindern und Jugendlichen im Rahmen aller Vereinsaktivitäten aktiv zu schützen.</li>
        <li>Das vom Verein verabschiedete Kinderschutzkonzept ist für alle Angestellten, Vorstände, Trainer und ehrenamtlichen Helfer rechtlich und operativ verbindlich.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 15 Haftungsbeschränkung</h2>
      <p>
        Der Verein sowie seine ehrenamtlichen Vorstände und Übungsleiter haften gegenüber
        Mitgliedern für Schäden in Ausübung ihrer Tätigkeit nur bei Vorsatz oder grober Fahrlässigkeit.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 16 Auflösung des Vereins, Anfallberechtigung</h2>
      <p>
        Bei Auflösung des Vereins oder bei Wegfall steuerbegünstigter Zwecke fällt das Vermögen des
        Vereins an eine juristische Person des öffentlichen Rechts oder eine andere
        steuerbegünstigte Körperschaft, die es ausschließlich und unmittelbar für gemeinnützige
        Zwecke zur Förderung der Schwimmausbildung oder Jugendhilfe zu verwenden hat.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 17 Inkrafttreten</h2>
      <p>Diese Satzung wurde am Tag der Gründungsversammlung errichtet und tritt mit der Eintragung in das Vereinsregister in Kraft.</p>
    </LegalPage>
  ),
});
