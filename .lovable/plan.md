# Teilnehmer-Dialog verbreitern + Anfrage per Namensklick

## Problem
1. Das Teilnehmer-Fenster in der Kursverwaltung ist zu schmal (max. ca. 768 px), die Tabelle mit 9 Spalten wird abgeschnitten bzw. muss horizontal gescrollt werden.
2. Man kann von der Teilnehmerliste aus nicht sehen, aus welcher Kursanfrage der Teilnehmer stammt.

## Lösung

### 1. Breiteres Fenster
Der Teilnehmer-Dialog nutzt künftig fast die volle Bildschirmbreite (bis ca. 1400 px, auf kleineren Bildschirmen 95 % der Breite), Höhe weiter max. 90 % mit Scrollen. Damit sind alle Spalten (Name, Geburtsdatum, Kontakt, Status, Mitglied, Ergebnis, Bezahlt, Notiz, Aktionen) lesbar. Notiz-Spalte bleibt gekürzt, zeigt aber den vollen Text als Tooltip.

### 2. Klick auf den Namen zeigt die Anfrage
- Teilnehmer, die aus einer Kursanfrage entstanden sind, haben eine Verknüpfung zur Anfrage. Ihr Name wird als anklickbarer Link dargestellt.
- Klick öffnet ein zusätzliches Fenster „Kursanfrage" mit allen Angaben aus der ursprünglichen Anfrage: Eingangsdatum, Status, Eltern-Name/E-Mail/Telefon, Kind + Geburtsdatum, gewünschter Kurs, Schwimmniveau, Gesundheitshinweise, Nachricht, interne Notizen.
- Teilnehmer ohne verknüpfte Anfrage (manuell angelegt) bleiben normaler Text, mit dezentem Hinweis „manuell angelegt" im Tooltip.

## Technische Details
- Datei: `src/routes/_authenticated/admin/kurse.tsx`
- `DialogContent` des Teilnehmer-Dialogs: `max-w-3xl` → `w-[95vw] max-w-[1400px]`.
- Teilnehmer-Abfrage um `request_id` erweitern; beim Klick wird der zugehörige Datensatz aus `course_requests` geladen (Admin/Board/Trainer haben bereits Lesezugriff) und in einem neuen, schreibgeschützten Dialog angezeigt.
- Keine Datenbank- oder Rechteänderungen nötig.
