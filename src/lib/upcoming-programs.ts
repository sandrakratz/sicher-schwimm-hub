export interface UpcomingProgram {
  slug: string
  name: string
  ageRange: string
  targetGroup: string
  location: string
  period: string
  priceMember: number
  priceNonMember: number
  intro: string
  paragraphs: Array<string>
  frame: Array<string>
}

/** Slugs bestehender Programme, die in der öffentlichen Kursübersicht nicht mehr gezeigt werden. */
export const HIDDEN_PROGRAM_SLUGS = ['wassergewoehnung', 'eltern-kind', 'anfaenger-schwimmen']

export const NOT_BOOKABLE_NOTE =
  'Dieses Angebot ist derzeit noch nicht buchbar. Die ersten Termine werden bekannt gegeben, sobald die Wasserzeiten feststehen.'

export const UPCOMING_PROGRAMS: Array<UpcomingProgram> = [
  {
    slug: 'wasserzeit-babys-kleinkinder',
    name: 'Wasserzeit für Babys & Kleinkinder',
    ageRange: '3 Monate – 3 Jahre',
    targetGroup: 'Familien / Eltern & Kind',
    location: 'Kurbad Hennef',
    period: 'ab Ende 2026',
    priceMember: 210,
    priceNonMember: 240,
    intro: 'Wasser darf von Anfang an etwas Schönes sein.',
    paragraphs: [
      'In unserer Wasserzeit für Babys und Kleinkinder begleiten wir Familien dabei, gemeinsam positive Erfahrungen mit dem Wasser zu sammeln. Im Mittelpunkt stehen nicht Leistung oder frühes Schwimmenlernen, sondern Vertrauen, Sicherheit, Bewegung und Freude am Wasser.',
      'Ein Elternteil ist gemeinsam mit dem Kind im Wasser. Unsere Trainerinnen begleiten die Familien aktiv im Wasser, beobachten das einzelne Kind und geben individuelle Anregungen. Dabei darf jedes Kind sein eigenes Tempo bestimmen.',
      'Wir möchten Eltern zeigen, wie sie ihr Kind sicher und vertrauensvoll an das Wasser heranführen können – vom ersten Planschen über das Bewegen und Schweben bis hin zu ersten Erfahrungen mit Wasser im Gesicht.',
      'Die Wasserzeit ist bewusst kein klassischer Schwimmkurs. Sie schafft vielmehr eine gute Grundlage für einen sicheren und positiven Umgang mit dem Wasser.',
    ],
    frame: [
      '8 Termine',
      'ca. 40 Minuten aktive Wasserzeit',
      '1 Elternteil + 1 Kind',
      'mindestens 7, maximal 8 Familien',
      'angeleitete Wasserzeit mit den Trainerinnen im Wasser',
    ],
  },
  {
    slug: 'wasserzeit-kinder-eltern',
    name: 'Wasserzeit für Kinder & Eltern',
    ageRange: '3 – 5 Jahre',
    targetGroup: 'Familien / Eltern & Kind',
    location: 'Kurbad Hennef',
    period: 'ab Ende 2026',
    priceMember: 210,
    priceNonMember: 240,
    intro: 'Mit Freude, Vertrauen und ganz viel Zeit zum Ausprobieren.',
    paragraphs: [
      'In unserer Wasserzeit für Kinder von 3 bis 5 Jahren entdecken Kinder gemeinsam mit einem Elternteil die Möglichkeiten des Wassers. Die Trainerinnen begleiten die Familien aktiv im Wasser und gehen individuell auf die Bedürfnisse und den Entwicklungsstand jedes Kindes ein.',
      'Wir möchten Kinder nicht möglichst schnell zu Schwimmern machen. Viel wichtiger ist uns, dass sie sich im Wasser sicher fühlen, Vertrauen entwickeln und ihre eigenen Fähigkeiten entdecken.',
      'Gemeinsam werden spielerisch verschiedene Erfahrungen gesammelt: Wasser im Gesicht, Pusten und Blubbern, Schweben, Gleiten, Tauchen, Bewegen und erste Sprungerfahrungen – immer ohne Druck und immer entsprechend dem eigenen Tempo des Kindes.',
      'Das Elternteil bleibt dabei die wichtigste Bezugsperson. Unsere Trainerinnen geben Impulse, zeigen Möglichkeiten und begleiten die Familie auf ihrem individuellen Weg.',
      'Auch dieses Angebot ist bewusst keine klassische Schwimmausbildung. Es geht zunächst darum, Sicherheit, Wasserkompetenz, Selbstvertrauen und Freude am Wasser zu entwickeln.',
    ],
    frame: [
      '8 Termine',
      'ca. 40 Minuten aktive Wasserzeit',
      '1 Elternteil + 1 Kind',
      'mindestens 7, maximal 8 Familien',
      'angeleitete Wasserzeit mit den Trainerinnen im Wasser',
    ],
  },
]
