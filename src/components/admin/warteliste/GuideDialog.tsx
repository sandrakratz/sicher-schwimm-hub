import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Inhalt des Leitfadens: Überschrift und Stichpunkte je Abschnitt. */
const GUIDE: Array<[string, string[]]> = [
  [
    "1. Reihenfolge der Platzvergabe",
    [
      "Aktive Vereinsmitglieder zuerst, danach nach Eingangsdatum.",
      "Nur Kinder, die zum Kursbeginn das Mindestalter erreichen.",
      "Kinder mit „Erst zuteilen ab“ erst für Kurse ab diesem Datum.",
      "Programme mit ausgeschalteter Warteliste nehmen keine neuen Einträge an.",
      "„Passt das?“: Automatisch angeboten wird nur, wenn das Schwimmniveau zum Mindest-Niveau des Angebots passt. Andere Fälle erscheinen im Eingang unter „Passt das?“ mit Begründung; der Vorstand bietet dann von Hand an. Das Mindest-Niveau stellst du je Angebot in der Kursverwaltung ein.",
    ],
  ],
  [
    "2. Platzangebot",
    [
      "Eltern erhalten eine E-Mail mit Zusage-/Absage-Link. Frist: laut Programm (Standard 3 Tage).",
      "Offene Angebote zählen als reservierte Plätze.",
      "Zusage = verbindliche Buchung mit Zahlungsfrist; der Absage-Zähler wird auf 0 gesetzt.",
    ],
  ],
  [
    "3. Absage durch die Eltern",
    [
      "Der Platz wird frei und geht sofort an das nächste passende Kind.",
      "Eltern entscheiden direkt: auf der Warteliste bleiben oder abmelden. Wer bleibt, fällt auf die Warteliste zurück und wird frühestens für den nächsten Kurs (Start nach dem abgelehnten Kurs) wieder berücksichtigt, ggf. erst ab einem Wunschdatum.",
      "Absage-Zähler +1, Grund und Entscheidung werden in den internen Notizen vermerkt.",
      "Kam die Absage per Telefon oder E-Mail, im Reiter „Angebote“ auf „Absage erfassen“ klicken – der Platz wird dann freigegeben.",
      "Alle Familien mit mindestens einer Absage stehen zum Nachhalten im Reiter „Absagen“ (zusätzlich zu ihrem eigentlichen Reiter). Der Reiter „Heute“ zeigt, was gerade zu tun ist; die Suche findet eine Familie in allen Reitern.",
    ],
  ],
  [
    "4. Frist ohne Antwort abgelaufen",
    [
      "Zählt wie eine Absage (Zähler +1), der Platz geht an das nächste Kind.",
      "Eltern erhalten eine Rückfrage „Warteliste behalten?“ mit 7 Tagen Frist; solange sie läuft, steht der Eintrag im Reiter „Rückfragen“.",
      "Keine Antwort auf die Rückfrage → Wartelistenplatz wird gestrichen (Reiter „Archiv“). Keine automatische Sperrliste.",
    ],
  ],
  [
    "5. Die 3-Absagen-Regel",
    [
      "Beim 3. abgesagten oder unbeantworteten Angebot wird der Wartelistenplatz automatisch deaktiviert.",
      "Die Eltern werden per E-Mail informiert: erneute Buchung nur über den Vorstand.",
      "In der Tabelle: 1× grau, 2× gelb, 3× rot.",
      "Der Zähler gilt je Eltern-E-Mail bzw. Kind über alle Einträge und zählt auch Stornierungen gebuchter Plätze (Umbuchung, „zurück auf die Warteliste“) mit: ein neuer Eintrag setzt ihn nicht zurück. Ab 3 Absagen/Stornierungen gesamt erscheint „Sperrliste prüfen“; gesperrt wird nie automatisch, sondern nur per Klick auf „Sperren“. „Ignorieren“ blendet den Vorschlag dauerhaft aus.",
    ],
  ],
  [
    "6. Was der Vorstand jederzeit tun kann",
    [
      "Zähler zurücksetzen (z. B. bei Krankheit) über den Button „Zähler zurücksetzen“.",
      "Kind mit „Wieder auf die Warteliste“ reaktivieren, manuell anbieten oder direkt buchen.",
      "Familie meldet sich selbst ab (z. B. bleibt bei einer anderen Schwimmschule): „Abmelden“ mit Grund – geht bei „Wartend“, „Abgesagt“ und „Frist abgelaufen“, auch in der Familienakte. Der Eintrag bleibt als „Abgemeldet“ mit dem Grund in der Notiz erhalten und zählt nicht als Absage. Bei offenem Angebot stattdessen „Absage erfassen“. Nicht löschen.",
      "Familien, die Angebote wiederholt ablaufen lassen, über den Sperrvorschlag oder manuell auf die Sperrliste setzen.",
      "Zuständigkeit: Der Knopf „Zuweisen“ (in „Heute“ an jedem Namen, in der Tabelle in der Spalte „Zuständig“) weist einem Vorstandsmitglied zu oder gibt mit einer Notiz weiter; die Person bekommt eine E-Mail. Standard-Zuständigkeiten stehen unter „Mitglieder“ → „Zuständigkeiten“. Wiedervorlage am: in der aufgeklappten Zeile; fällige stehen in „Heute“.",
      "„Familie, Verlauf“ zeigt alle Kinder, Buchungen, Absagen, E-Mails und Sperrliste einer Familie auf einer Seite. Der Reiter „Nachfrage“ zeigt, wo sich ein zusätzlicher Kurs lohnt.",
    ],
  ],
];

/** Leitfaden für den Vorstand: Fristen, Regeln und Folgen der Anfrageliste. */
export function GuideDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Leitfaden: Fristen, Regeln und Folgen der Anfrageliste</DialogTitle>
          <DialogDescription>
            Für den Vorstand – so arbeitet die Warteliste automatisch
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {GUIDE.map(([title, items]) => (
            <div key={title}>
              <p className="font-semibold">{title}</p>
              <ul className="ml-5 list-disc text-muted-foreground">
                {items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
