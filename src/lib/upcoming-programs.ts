export const NOT_BOOKABLE_NOTE =
  'Dieses Angebot ist derzeit noch nicht buchbar. Die ersten Termine werden bekannt gegeben, sobald die Wasserzeiten feststehen.'

/**
 * Kompakte Kurzbeschreibungen für die Kursübersicht (/kurse).
 * Die ausführlichen Texte bleiben in der Datenbank und auf den Detailseiten erhalten.
 */
export const PROGRAM_CARD_SUMMARIES: Record<string, string[]> = {
  'wasserzeit-babys-kleinkinder': [
    'Wasser darf von Anfang an etwas Schönes sein.',
    'Gemeinsam mit einem Elternteil entdecken die Kinder spielerisch das Wasser. Unsere Trainerinnen begleiten jede Familie individuell und geben Anregungen für Bewegung, Sicherheit und Vertrauen im Wasser – ganz ohne Leistungsdruck.',
  ],
  'wasserzeit-kinder-eltern': [
    'Mit Freude, Vertrauen und ganz viel Zeit zum Ausprobieren.',
    'Gemeinsam mit einem Elternteil sammeln die Kinder vielfältige Erfahrungen im Wasser. Unsere Trainerinnen begleiten die Familien individuell und unterstützen jedes Kind dabei, Sicherheit, Vertrauen und Freude am Wasser zu entwickeln.',
  ],
}
