# Hinweis auf KI-generierte Bilder

Kurz: **nicht in den Cookie-Hinweis**. Cookie-Banner/Consent betrifft nur Speicherung und Zugriff auf Endgeräte-Informationen — ein Bildquellen-Hinweis gehört dort nicht hin und geht unter. Der richtige Ort ist ein **Bildnachweis im Impressum**, ergänzt um einen kurzen Hinweis direkt dort, wo KI-Bilder prominent auftauchen.

## Vorschlag

1. **Impressum — neuer Abschnitt „Bildnachweise“** (Hauptort, dauerhaft auffindbar)
   Text z. B.:
   „Ein Teil der auf dieser Website verwendeten Bilder wurde mit Hilfe künstlicher Intelligenz erstellt. Diese Bilder dienen ausschließlich der Illustration und zeigen keine realen Personen, Veranstaltungen oder Kursorte des Vereins.“

2. **Footer — Link „Bildnachweise“** (springt zum Impressum-Abschnitt), damit der Hinweis von jeder Seite in einem Klick erreichbar ist.

3. **Kontextueller Kurzhinweis** auf Seiten mit vielen Illustrationsbildern (Startseite, Kurse, Über uns): eine dezente Zeile unter dem Bildbereich bzw. am Sektionsende, z. B. „Abbildungen teilweise KI-generiert.“ — klein, in gedämpfter Schriftfarbe, im bestehenden Design.

Optional, falls gewünscht: `alt`-Texte der betroffenen Bilder um „(KI-generierte Illustration)“ ergänzen — hilft Barrierefreiheit und Transparenz zugleich.

## Technische Details

- `src/routes/impressum.tsx`: neue Card/Sektion „Bildnachweise“ mit `id="bildnachweise"`, gleiche Card-/Typo-Struktur wie die bestehenden Abschnitte.
- `src/components/SiteFooter.tsx`: Link `/impressum#bildnachweise` in der bestehenden Rechtliches-Linkliste.
- `src/routes/index.tsx`, `src/routes/kurse.tsx`, `src/routes/ueber-uns.tsx`: je eine kleine Hinweiszeile mit vorhandenen Muted-Text-Tokens (keine neuen Farben/Fonts).
- Keine Änderung am Cookie-/Consent-Text und keine neuen Abhängigkeiten.
