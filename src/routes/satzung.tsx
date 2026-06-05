import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/satzung")({
  head: () => ({ meta: [{ title: "Vereinssatzung – Sicher Schwimmen e.V." }] }),
  component: () => (
    <LegalPage title="Vereinssatzung">
      <p className="text-sm text-muted-foreground">
        Endfassung gemäß Gründungshandbuch. Die Satzung tritt mit Eintragung in das Vereinsregister in Kraft.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 1 Name, Sitz, Geschäftsjahr</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Der Verein führt den Namen „Sicher Schwimmen". Er soll in das Vereinsregister eingetragen werden und führt danach den Zusatz „e. V.".</li>
        <li>Der Verein hat seinen Sitz im Rhein-Sieg-Kreis.</li>
        <li>Das Geschäftsjahr ist das Kalenderjahr.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 2 Zweck des Vereins, Gemeinnützigkeit</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Der Verein verfolgt ausschließlich und unmittelbar gemeinnützige Zwecke im Sinne des Abschnitts „Steuerbegünstigte Zwecke" der Abgabenordnung (AO).</li>
        <li>Zweck des Vereins ist die Förderung des Sports, insbesondere der Schwimmausbildung und der Wassersicherheit, sowie die Förderung der Jugendhilfe.</li>
        <li>Der Satzungszweck wird verwirklicht insbesondere durch die Durchführung von Schwimmkursen und Angeboten zur Wassergewöhnung, Sicherheits- und Präventionsangebote rund um das Thema Wasser, die Aus- und Fortbildung von Übungsleitern und Helfern sowie spezifische Kinder- und Jugendangebote zur Förderung der motorischen und psychosozialen Entwicklung.</li>
        <li>Der Verein ist selbstlos tätig; er verfolgt nicht in erster Linie eigenwirtschaftliche Zwecke.</li>
        <li>Mittel des Vereins dürfen nur für die satzungsmäßigen Zwecke verwendet werden. Die Mitglieder erhalten in ihrer Eigenschaft als Mitglieder keine Zuwendungen aus Mitteln des Vereins.</li>
        <li>Es darf keine Person durch Ausgaben, die dem Zweck der Körperschaft fremd sind, oder durch unverhältnismäßig hohe Vergütungen begünstigt werden.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 3 Erwerb der Mitgliedschaft</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Mitglied des Vereins kann jede natürliche und juristische Person werden.</li>
        <li>Der Aufnahmeantrag ist in Textform an den Vorstand zu richten. Bei Minderjährigen ist der Antrag von den gesetzlichen Vertretern zu unterzeichnen.</li>
        <li>Über den Aufnahmeantrag entscheidet der Vorstand nach pflichtgemäßem Ermessen diskriminierungsfrei. Ein Rechtsanspruch auf Aufnahme besteht nicht, soweit kein zwingendes Recht entgegensteht.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 4 Arten der Mitgliedschaft</h2>
      <ul className="list-disc pl-5">
        <li>Ordentliche Mitglieder (Kinder, Jugendliche, Erwachsene)</li>
        <li>Familienmitglieder</li>
        <li>Fördermitglieder (ohne Stimmrecht)</li>
        <li>Ehrenmitglieder (optional, Ernennung durch die Mitgliederversammlung)</li>
      </ul>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 5 Beendigung der Mitgliedschaft</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Die Mitgliedschaft endet durch Austritt, Ausschluss, Tod der natürlichen oder Auflösung der juristischen Person.</li>
        <li>Der Austritt erfolgt durch Erklärung in Textform gegenüber dem Vorstand. Er ist nur unter Einhaltung einer Frist von sechs Wochen zum Ende des Geschäftsjahres zulässig.</li>
        <li>Ein Ausschluss kann erfolgen, wenn ein Mitglied in grober Weise gegen Satzung, Ordnungen oder den Vereinszweck verstößt. Vor der Entscheidung des Vorstands ist dem Mitglied unter angemessener Frist Gelegenheit zur Stellungnahme zu geben.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 6 Rechte und Pflichten der Mitglieder</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Die Mitglieder sind berechtigt, die Einrichtungen und Angebote des Vereins nach Maßgabe der Satzung und der Vereinsordnungen zu nutzen.</li>
        <li>Die Mitglieder sind verpflichtet, die Satzung und die Ordnungen des Vereins – insbesondere das Kinderschutzkonzept – einzuhalten und die festgesetzten Beiträge fristgerecht zu entrichten.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 7 Beiträge und Finanzen</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Von den Mitgliedern werden Beiträge erhoben. Höhe, Fälligkeit und Zahlungsweise regelt die von der Mitgliederversammlung beschlossene Beitragsordnung.</li>
        <li>Zur Deckung eines außergewöhnlichen Finanzbedarfs kann die Mitgliederversammlung Sonderumlagen beschließen. Diese dürfen den Betrag eines Jahresbeitrags je Mitglied und Geschäftsjahr nicht überschreiten.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 8 Organe des Vereins</h2>
      <p>Organe des Vereins sind die Mitgliederversammlung und der Vorstand.</p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 9 Die Mitgliederversammlung</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Die ordentliche Mitgliederversammlung findet einmal jährlich statt.</li>
        <li>Sie wird vom Vorstand in Textform unter Einhaltung einer Frist von zwei Wochen und unter Angabe der Tagesordnung einberufen.</li>
        <li>Die Mitgliederversammlung ist ohne Rücksicht auf die Zahl der erschienenen Mitglieder beschlussfähig.</li>
        <li>Beschlüsse werden mit einfacher Mehrheit gefasst. Satzungsänderungen bedürfen einer Mehrheit von 3/4, die Auflösung des Vereins einer Mehrheit von 4/5 der abgegebenen gültigen Stimmen.</li>
        <li>Über die Beschlüsse ist ein Protokoll aufzunehmen, das vom Versammlungsleiter und vom Protokollführer zu unterzeichnen ist.</li>
        <li>Die Versammlung kann als Präsenz-, virtuelle oder hybride Veranstaltung durchgeführt werden. Den Modus legt der Vorstand bei der Einberufung fest.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 10 Der Vorstand</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Der geschäftsführende Vorstand im Sinne des § 26 BGB besteht aus der/dem 1. Vorsitzenden, der/dem 2. Vorsitzenden und der/dem Kassenwart/in.</li>
        <li>Der Verein wird gerichtlich und außergerichtlich durch zwei Vorstandsmitglieder gemeinsam vertreten.</li>
        <li>Für definierte Geschäfte des täglichen Lebens kann der Vorstand im Innenverhältnis Einzelvollmachten erteilen.</li>
        <li>Der Vorstand wird von der Mitgliederversammlung für die Dauer von zwei Jahren gewählt und bleibt bis zur rechtsgültigen Wahl eines neuen Vorstands im Amt.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 11 Vereinsordnungen</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Zur Ausgestaltung der internen Vereinsarbeit können Vereinsordnungen erlassen werden, insbesondere eine Beitragsordnung, eine Datenschutzordnung, eine Kinderschutzordnung sowie eine Ehrenamts-, Vergütungs- und Kursordnung.</li>
        <li>Die Satzung hat stets Vorrang vor den Ordnungen.</li>
        <li>Ordnungen mit wesentlichen finanziellen oder persönlichen Pflichten bedürfen des Beschlusses der Mitgliederversammlung. Andere Ordnungen können vom Vorstand erlassen werden.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 12 Vergütung, Aufwandsersatz</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Die Vereins- und Organämter werden grundsätzlich ehrenamtlich ausgeübt.</li>
        <li>Bei Bedarf können Ämter entgeltlich auf Grundlage eines Dienst- oder Honorarvertrages oder gegen Zahlung einer Aufwandsentschädigung nach § 3 Nr. 26a EStG (Ehrenamtspauschale) ausgeübt werden.</li>
        <li>Erstattungen von Auslagen gegen Beleg sind zulässig.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 13 Kassenprüfung</h2>
      <p>
        Die Mitgliederversammlung wählt zwei Kassenprüfer/innen für die Dauer von zwei Jahren. Diese dürfen nicht
        dem Vorstand angehören. Sie prüfen die Kasse jährlich und erstatten der Mitgliederversammlung Bericht.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 14 Kinderschutz, Prävention und sichere Durchführung</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Der Verein verurteilt jede Form von Gewalt und Missbrauch und erlässt zum Schutz der anvertrauten Kinder und Jugendlichen ein verpflichtendes Kinderschutzkonzept.</li>
        <li>Alle ehren- und hauptamtlich Tätigen mit direktem Kontakt zu Minderjährigen unterziehen sich einer Eignungsprüfung, unterzeichnen den Verhaltenskodex und legen – soweit gesetzlich oder durch das Konzept gefordert – ein erweitertes Führungszeugnis (eFZ) vor.</li>
        <li>Die qualifizierte Besetzung und Sicherheit der Wasserangebote wird in einer Kursordnung detailliert geregelt.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 15 Haftung</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Die gesetzliche Haftung des Vereins und seiner Organe für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit bleibt unberührt.</li>
        <li>Für sonstige Schäden ist die Haftung gegenüber den Mitgliedern auf Vorsatz und grobe Fahrlässigkeit beschränkt, soweit gesetzlich zulässig.</li>
        <li>Die Haftungsprivilegierungen der §§ 31a, 31b BGB bleiben unberührt.</li>
        <li>Der Verein haftet nicht für abhandengekommene Garderobe oder Wertsachen, es sei denn, dem Verein fällt Vorsatz oder grobe Fahrlässigkeit zur Last.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 16 Auflösung, Vermögensbindung</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Die Auflösung kann nur in einer eigens dazu einberufenen Mitgliederversammlung mit einer Mehrheit von 4/5 der abgegebenen gültigen Stimmen beschlossen werden.</li>
        <li>Bei Auflösung oder Wegfall steuerbegünstigter Zwecke fällt das Vermögen an eine juristische Person des öffentlichen Rechts oder eine andere steuerbegünstigte Körperschaft zur Förderung des Sports (insbesondere der Schwimmausbildung) oder der Jugendhilfe.</li>
      </ol>

      <h2 className="font-display text-2xl font-bold text-primary-deep">§ 17 Inkrafttreten</h2>
      <p>Diese Satzung wurde in der Gründungsversammlung errichtet und tritt mit der Eintragung in das Vereinsregister in Kraft.</p>
    </LegalPage>
  ),
});
