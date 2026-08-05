# Kursangebote mit buchbaren Zeiträumen

Kursübersicht und Kursverwaltung teilen sich künftig eine gemeinsame Datenbasis. Ein Kursangebot (z. B. „Seepferdchen im Kurhaus") wird einmal gepflegt, danach müssen nur noch neue Zeiträume eingetragen werden.

## Struktur

```text
Kursangebot (Seepferdchen im Kurhaus)
  Beschreibung, Voraussetzungen, Mindestalter, Ort, Preise, Bild/Reihenfolge
  ├─ Zeitraum 06.09.26 – 04.10.26   (10 Plätze, ausgebucht → wird ausgeblendet)
  └─ Zeitraum 11.10.26 – 08.11.26   (10 Plätze, 4 frei → buchbar)
```

## Öffentliche Kursübersicht (/kurse)

- Zeigt alle veröffentlichten Kursangebote aus der Datenbank (Kacheln wie bisher: Zielgruppe, Alter, Beschreibung, Voraussetzungen, Ort, Preise).
- Pro Kachel ein Hinweis, wie viele Termine aktuell buchbar sind.
- Klick auf die Kachel öffnet die Angebotsseite `/kurse/<angebot>` mit allen buchbaren Zeiträumen: Datum von–bis, Wochentag/Uhrzeit, Ort, freie Plätze, Preis.
- Ausgebuchte oder bereits gestartete Zeiträume werden ausgeblendet.
- Gibt es aktuell keinen freien Zeitraum: Hinweis plus Button „Auf die Warteliste" (führt zum bestehenden Anfrageformular).
- Bankverbindungs-Box, Kursbedingungen-Hinweis und Widerrufs-Button bleiben unverändert.

## Buchung

- Buchung läuft weiterhin über das bekannte Formular „Kursanfrage & Warteliste" – kein Login nötig (Login bleibt Vereinsmitgliedern vorbehalten).
- Neu: Vom gewählten Zeitraum aus wird das Formular mit Kursangebot und Zeitraum vorbelegt und als **verbindliche Buchung** gekennzeichnet (Bestätigung der Kursbedingungen ist Pflicht).
- Altersprüfung: Das Geburtsdatum des Kindes wird gegen das Mindestalter zum Kursstart geprüft. Ist das Mindestalter am Kursbeginn nicht erreicht, ist die verbindliche Buchung nicht möglich (Hinweis + Angebot Warteliste). Eine Altersobergrenze gibt es nicht.
- Nach dem Absenden wie gewohnt Bestätigungsfenster; Buchungen erscheinen in der Kursverwaltung direkt beim jeweiligen Zeitraum und lösen die Admin-Benachrichtigung aus.
- Sind die Plätze zwischenzeitlich belegt, wird die Buchung automatisch als Warteliste geführt und das dem Elternteil im Bestätigungsfenster mitgeteilt.

## Kursverwaltung (Admin)

- Neuer Reiter/Ebene „Kursangebote": Angebote anlegen und bearbeiten (Name, Ort, Zielgruppe, Alter/Mindestalter, Beschreibung, Voraussetzungen, Dauer, Preise, öffentlich sichtbar ja/nein, Reihenfolge).
- Unter jedem Angebot die Liste der Zeiträume mit Start/Ende, Zeitplan, max. Teilnehmer, Status, belegten/freien Plätzen und dem Button „Neuer Zeitraum" (übernimmt alle Angebotsdaten, nur Datum/Plätze eintragen).
- Teilnehmerverwaltung, Excel-Export, Archivieren und die Zuordnung von Anfragen bleiben unverändert und hängen weiterhin am einzelnen Zeitraum.
- Die 7 bisher fest hinterlegten Kurse werden als Kursangebote übernommen; die beiden vorhandenen Kurstermine werden dem Angebot „Seepferdchen im Kurhaus" zugeordnet.

## Technisches

- Neue Tabelle `course_programs` (Angebotsdaten inkl. `min_age_years`, `sort_order`, `is_public`), `courses` bekommt `program_id`. GRANTs plus RLS: öffentliches Lesen nur für veröffentlichte Angebote, Schreiben nur für admin/board/trainer.
- Neue öffentliche Leseabfrage per Server-Funktion (publishable client) für Angebote inkl. freier Plätze (bestätigte Teilnehmer je Kurs), damit SSR und OG-Tags funktionieren.
- Neue Route `src/routes/kurse.$slug.tsx` mit eigenem `head()`; `/kurse` lädt Angebote per Loader + Query statt der Konstante im Code.
- Buchung über eine öffentliche Server-Funktion, die Platzverfügbarkeit und Mindestalter serverseitig prüft und `course_requests` + `course_participants` (confirmed/waiting) schreibt.
- Migration legt Tabelle, Policies und die Startdaten der 7 Angebote als INSERTs an.
