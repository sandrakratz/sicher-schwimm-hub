# Kursverwaltung: alles an einem Ort

Statt drei getrennter Listen („Aktive Kurse", „Erledigte Kurse", „Kursangebote") gibt es künftig **eine Übersicht der Kursangebote als Kacheln**. Ein Klick auf eine Kachel öffnet den Kurs vollständig: Angebotsdaten bearbeiten und direkt darunter alle Zeiträume verwalten bzw. neue anlegen.

## Übersicht

- Kachel-Raster aller Kursangebote (Seepferdchen im Kurhaus, Bronze usw.).
- Pro Kachel: Name, Ort, Altersangabe, Preise, Anzahl buchbarer Zeiträume, belegte/freie Plätze gesamt, Hinweis „Intern" wenn nicht öffentlich.
- Buttons in der Kachel: „Öffnen" (Detailansicht) und „Neuer Zeitraum" (springt direkt ins Zeitraum-Formular dieses Angebots).
- Oben: „Neues Kursangebot" und ein Umschalter „Archiv anzeigen" für erledigte Zeiträume.
- Nicht zugeordnete Zeiträume (ohne Angebot) erscheinen als eigene Kachel „Ohne Kursangebot", damit nichts verloren geht.

## Detailansicht eines Kursangebots

Öffnet sich als breites Fenster mit zwei Bereichen:

1. **Angebotsdaten bearbeiten** – Name, Ort, Zielgruppe, Altersbereich, Mindestalter, Beschreibung, Voraussetzungen, Dauer, Preise (Mitglied / Nicht-Mitglied), Zahlungsfrist, öffentlich sichtbar, Reihenfolge. Speichern direkt in der Ansicht.
2. **Zeiträume** – Liste aller Zeiträume dieses Angebots mit Datum von–bis, Zeitplan, Status, belegten/freien Plätzen. Pro Zeitraum die gewohnten Aktionen: Teilnehmer, Termine, Excel-Kursliste, Bearbeiten, Archivieren/Wiederherstellen, Löschen.
   - Button „Neuer Zeitraum": Formular direkt in der Ansicht, Angebot ist vorbelegt, Preise/Ort/Dauer werden aus dem Angebot übernommen – es müssen nur Datum, Zeitplan und Plätze eingetragen werden.
   - Archivierte Zeiträume sind einklappbar am Ende der Liste.

## Was gleich bleibt

- Teilnehmerverwaltung, Klick auf Kindernamen für die Anfrage, Termine-Dialog, Excel-Export und Zuordnung von Anfragen bleiben unverändert.
- Öffentliche Kursübersicht und Buchung ändern sich nicht.

## Technisches

- Nur `src/routes/_authenticated/admin/kurse.tsx` wird umgebaut; keine Datenbank- oder Server-Funktions-Änderungen.
- Bestehende Lade-/Speicherlogik (`load`, `save`, `saveProgram`, `openParticipants`, `openSessions`, `exportCourseList`, Archivieren/Löschen) wird wiederverwendet, nur die Darstellung wechselt von Tabellen-Tabs zu Kachel-Übersicht + Detail-Dialog.
- Der Zeitraum-Dialog wird um eine Vorbelegung aus dem Angebot ergänzt (Ort, Dauer, Preise, Zahlungsfrist, Zielgruppe, Altersbereich, Name als Vorschlag).
- Um die Datei handhabbar zu halten, werden Kachel, Detailansicht und Zeitraum-Formular in eigene Komponenten unter `src/components/admin/` ausgelagert.
