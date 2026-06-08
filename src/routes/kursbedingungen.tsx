import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/kursbedingungen")({
  head: () => ({
    meta: [
      { title: "Kursteilnahmebedingungen – Sicher Schwimmen e.V." },
      { name: "description", content: "Teilnahmebedingungen für Schwimmkurse beim Sicher Schwimmen e.V. in Hennef: Anmeldung, Zahlung, Rücktritt, Aufsichtspflicht und Haftung." },
    ],
  }),
  component: KursbedingungenPage,
});

function KursbedingungenPage() {
  return (
    <LegalPage title="Kursteilnahmebedingungen">
      <p className="text-sm text-muted-foreground">Stand: Juni 2026</p>

      <h2 className="font-display text-2xl font-bold text-primary-deep mt-8">1. Anmeldung &amp; Bestätigung</h2>
      <p>
        Die Anmeldung zu einem Schwimmkurs erfolgt über das Anfrageformular auf
        unserer Webseite. Die Teilnahme ist <strong>erst nach schriftlicher
        Bestätigung</strong> durch den Verein per E-Mail verbindlich. Bis dahin
        besteht kein Anspruch auf einen Kursplatz. Mitglieder werden bei der
        Platzvergabe bevorzugt berücksichtigt.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep mt-8">2. Kursgebühr &amp; Zahlung</h2>
      <p>
        Die Kursgebühr beträgt <strong>200 € für Nichtmitglieder</strong> bzw.
        <strong> 150 € für Vereinsmitglieder</strong> und umfasst in der Regel
        10 Einheiten à 45 Minuten. Die Gebühr ist innerhalb von
        <strong> 14 Tagen nach Bestätigung</strong> per Überweisung auf das in
        der Bestätigungsmail genannte Vereinskonto zu zahlen. Beginnt der Kurs
        innerhalb dieser 14 Tage, ist die Gebühr <strong>spätestens einen Tag
        vor Kursbeginn</strong> zu überweisen. Ohne fristgerechten Zahlungseingang
        kann der Kursplatz anderweitig vergeben werden.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep mt-8">3. Rücktritt durch die Teilnehmer:innen</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Bis 3 Wochen vor Kursbeginn:</strong> kostenfreier Rücktritt, bereits gezahlte Gebühren werden vollständig erstattet.</li>
        <li><strong>Bis 7 Tage vor Kursbeginn:</strong> Es werden 50 % der Kursgebühr als Bearbeitungspauschale fällig.</li>
        <li><strong>Ab Kursbeginn:</strong> Die volle Kursgebühr ist zu zahlen, eine Erstattung ist nicht mehr möglich.</li>
      </ul>
      <p>Der Rücktritt muss schriftlich per E-Mail an <a href="mailto:kurse@sicher-schwimmen.com" className="text-primary underline">kurse@sicher-schwimmen.com</a> erfolgen. Maßgeblich ist der Eingang beim Verein.</p>

      <h2 className="font-display text-2xl font-bold text-primary-deep mt-8">4. Rücktritt durch den Verein</h2>
      <p>
        Der Verein behält sich vor, einen Kurs bei zu geringer Teilnehmerzahl,
        Schließung des Schwimmbads oder anderen wichtigen Gründen abzusagen oder
        zu verschieben. In diesem Fall werden bereits gezahlte Kursgebühren
        <strong> vollständig erstattet</strong>; weitergehende Ansprüche bestehen
        nicht.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep mt-8">5. Versäumte Stunden</h2>
      <p>
        Bei Versäumnis einzelner Kursstunden durch die Teilnehmer:innen – etwa
        wegen Krankheit, Urlaub oder anderer persönlicher Gründe – besteht
        <strong> kein Anspruch auf Ersatzstunden oder anteilige Erstattung</strong>
        der Kursgebühr.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep mt-8">6. Ausfall durch Krankheit, Pandemie oder höhere Gewalt</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Krankheit aller Übungsleiter:innen:</strong> Kursstunden, die deshalb ausfallen, werden zu einem späteren Termin als <strong>Ersatztermin</strong> nachgeholt.</li>
        <li><strong>Pandemie, behördliche Anordnungen oder höhere Gewalt</strong> (z.B. Schließung des Schwimmbads): Es besteht <strong>kein Anspruch auf Ersatztermine oder Erstattung</strong>. Der Vorstand entscheidet im Einzelfall über mögliche Kulanzregelungen.</li>
      </ul>

      <h2 className="font-display text-2xl font-bold text-primary-deep mt-8">7. Aufsichtspflicht</h2>
      <p>
        Die Aufsichtspflicht der Eltern bzw. Erziehungsberechtigten besteht
        <strong> bis zur Umkleidekabine</strong>. Ab dem Ausgang der Umkleide
        in Richtung Schwimmhalle übernimmt der/die <strong>Übungsleiter:in</strong>
        die Aufsicht während der Kurseinheit. Nach Ende der Kurseinheit endet
        die Aufsichtspflicht des Übungsleiters wieder am Ausgang der Umkleide;
        ab dort übernehmen die Eltern bzw. Erziehungsberechtigten erneut.
        Wir bitten darum, Kinder pünktlich zu bringen und abzuholen.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep mt-8">8. Haftung</h2>
      <p>
        Die Haftung des Vereins, seiner Vorstandsmitglieder und Übungsleiter:innen
        ist auf <strong>Vorsatz und grobe Fahrlässigkeit</strong> beschränkt.
        Für mitgebrachte <strong>Wertsachen</strong> in Umkleiden und
        Schwimmhalle wird <strong>keine Haftung</strong> übernommen; wir
        empfehlen, Wertgegenstände zu Hause zu lassen.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep mt-8">9. Bild- und Tonaufnahmen</h2>
      <p>
        Foto- oder Videoaufnahmen während der Kurseinheiten erfolgen
        ausschließlich mit <strong>separater schriftlicher Einwilligung</strong>
        der Erziehungsberechtigten. Eine Veröffentlichung in Vereinsmedien
        (Webseite, Social Media, Print) ist nur nach ausdrücklicher Zustimmung
        zulässig.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep mt-8">10. Gesundheit</h2>
      <p>
        Teilnehmer:innen müssen <strong>gesundheitlich für den Schwimmunterricht
        geeignet</strong> sein. Eltern bzw. Erziehungsberechtigte sind verpflichtet,
        dem Verein vor Kursbeginn alle <strong>relevanten Erkrankungen oder
        Einschränkungen</strong> – etwa Autismus, ADHS, Epilepsie, Allergien,
        körperliche oder sonstige Einschränkungen – mitzuteilen, damit die
        Übungsleiter:innen angemessen darauf eingehen können. Diese Informationen
        werden vertraulich behandelt.
      </p>

      <h2 className="font-display text-2xl font-bold text-primary-deep mt-8">Kontakt</h2>
      <p>
        Bei Fragen zu diesen Bedingungen oder zu einem konkreten Kurs wenden Sie
        sich bitte an: <a href="mailto:kurse@sicher-schwimmen.com" className="text-primary underline">kurse@sicher-schwimmen.com</a>
      </p>
    </LegalPage>
  );
}
