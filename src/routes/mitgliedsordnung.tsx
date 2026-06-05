import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/mitgliedsordnung")({
  head: () => ({ meta: [{ title: "Mitgliedsordnung – Sicher Schwimmen e.V." }] }),
  component: () => (
    <LegalPage title="Mitglieds-, Beitrags- und Kursordnung">
      <p>
        Diese Ordnung fasst die für Mitglieder relevanten Regelungen aus dem Gründungshandbuch
        (Teile 3 und 6) zusammen und konkretisiert §§ 6 und 7 der Vereinssatzung.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">1. Beitragsordnung</h2>
      <p>Auf Grundlage von § 7 der Satzung gelten folgende Jahresbeiträge:</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="border p-3 text-left">Mitgliedschaftsart</th>
              <th className="border p-3 text-left">Jahresbeitrag</th>
              <th className="border p-3 text-left">Erläuterung</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-3">Einzelmitgliedschaft</td>
              <td className="border p-3">60,00 €</td>
              <td className="border p-3">Kinder, Jugendliche und Erwachsene.</td>
            </tr>
            <tr>
              <td className="border p-3">Familienmitgliedschaft</td>
              <td className="border p-3">96,00 €</td>
              <td className="border p-3">Ab 3 Personen (max. 2 Erwachsene, im selben Haushalt lebende Kinder unter 18).</td>
            </tr>
            <tr>
              <td className="border p-3">Fördermitgliedschaft</td>
              <td className="border p-3">ab 60,00 €</td>
              <td className="border p-3">Passives Mitglied ohne Stimmrecht, Beitrag nach oben frei wählbar.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="font-display text-2xl font-bold text-primary-deep">2. Zahlungsmodalitäten & Fälligkeit</h2>
      <ul className="list-disc pl-5">
        <li>Der Jahresbeitrag ist jeweils zum <strong>1. März</strong> eines Jahres fällig und wird ausschließlich per SEPA-Basislastschrift eingezogen.</li>
        <li>Bei Eintritt nach dem <strong>1. Juli</strong> eines Jahres wird für das Beitrittsjahr nur der <strong>halbe Jahresbeitrag (50 %)</strong> fällig.</li>
        <li>Zusätzliche Kursgebühren (z. B. für spezielle Intensivkurse oder Material) werden gesondert in Rechnung gestellt und sind nicht durch den Mitgliedsbeitrag gedeckt.</li>
      </ul>

      <h2 className="font-display text-2xl font-bold text-primary-deep">3. Härtefallregelung</h2>
      <p>
        In begründeten sozialen Härtefällen kann der Vorstand auf schriftlichen Antrag den
        Mitgliedsbeitrag ganz oder teilweise stunden oder erlassen. Die Prüfung erfolgt vertraulich.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">4. Trennung von Mitgliedschaft und Kursbetrieb</h2>
      <p>
        Die reine Mitgliedschaft im Verein garantiert keinen sofortigen Kursplatz. Kapazitäten
        werden nach Verfügbarkeit und Warteliste vergeben.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">5. Eltern-Kind-Schwimmen (EKS) – Aufsichtspflicht</h2>
      <p>
        Beim Eltern-Kind-Schwimmen obliegt die <strong>primäre Individualaufsicht</strong> für das
        Kind ununterbrochen der begleitenden erwachsenen Person. Der Verein bzw. die Kursleitung
        bleibt rechtlich verantwortlich für die allgemeine Organisation, die sichere methodische
        Anleitung, die Prüfung der Umgebung und das Eingreifen bei erkennbaren Gefahrensituationen
        (Verkehrssicherungspflicht).
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep">6. Personalkategorien & Rettungsfähigkeit</h2>
      <p>
        Für jede Gruppe im Wasser muss sichergestellt sein, dass mindestens eine Person die
        notwendige Rettungsfähigkeit (orientiert am <strong>DRSA Silber</strong> oder äquivalentem
        Nachweis) besitzt.
      </p>
      <ul className="list-disc pl-5">
        <li><strong>Kursleitung:</strong> volljährig, fachlich geeignet, rettungsfähig; trägt die Gruppenverantwortung.</li>
        <li><strong>Jugendhelfer/in (ab 14 Jahre):</strong> unterstützt methodisch und organisatorisch; darf keine alleinige Gruppenverantwortung übernehmen.</li>
        <li><strong>Helfer/in in Ausbildung (unter 14 Jahre):</strong> darf ausschließlich hospitieren und nur unter unmittelbarer, ständiger Aufsicht der Kursleitung agieren.</li>
      </ul>

      <h2 className="font-display text-2xl font-bold text-primary-deep">7. Vorfallsdokumentation</h2>
      <p>
        Bei besonderen Vorfällen (Unfälle, Beinahe-Ertrinken) besteht eine sofortige Dokumentations-
        und Meldepflicht an den Vorstand.
      </p>
    </LegalPage>
  ),
});
