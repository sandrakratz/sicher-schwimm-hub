# Trainerbereich für Handys optimieren

Ziel: Trainer:innen erledigen alles am Handy – mit wenig Scrollen, großen Tippflächen und ohne breite Tabellen.

## Was sich ändert

### 1. Startseite (Trainerbereich)
- Ganz oben eine kompakte Zeile mit dem nächsten Termin (Datum, Kurs, Ort) und einem großen Button „Anwesenheit erfassen“.
- Die vier Zahlen-Kacheln werden zu einer schmalen Zeile mit 2 Werten sichtbar („Einsätze gesamt“, „Noch anstehend“); die übrigen Zahlen erscheinen erst beim Aufklappen.
- Offene Verfügbarkeits-Hinweise bleiben oben, aber kürzer formuliert und mit direktem Button.
- Termine standardmäßig eingeklappt; nur der nächste anstehende Kurs ist offen.

### 2. Meine Kurse
- Die breite Teilnehmer-Tabelle wird auf dem Handy durch Karten ersetzt: pro Kind eine Zeile mit Name, Alter und einem Aufklapp-Bereich für Kontakt und Hinweise.
- Zahlungsspalte bleibt wie bisher ausgeblendet für Trainer:innen.
- Auf großen Bildschirmen bleibt die Tabelle unverändert.
- „Anwesenheit erfassen“ rückt nach oben in die Kurskarte, damit es ohne Scrollen erreichbar ist.

### 3. Anwesenheit erfassen
- Termin-Auswahl als kompakte Auswahlliste statt langer Terminreihe; der nächste passende Termin ist vorausgewählt.
- Pro Kind eine Zeile mit drei großen Tipp-Feldern (Anwesend / Entschuldigt / Gefehlt), gut mit dem Daumen bedienbar.
- Speicherstatus wird kurz eingeblendet statt als dauerhafter Textblock.

### 4. Vereinsmitglieder
- Statt Tabelle auf dem Handy: Suchfeld oben (bleibt sichtbar), darunter je Mitgliedschaft eine kleine Karte; Partner:in und Kinder erscheinen erst beim Aufklappen.
- Liste zeigt zunächst die ersten Einträge mit „Mehr anzeigen“, damit die Seite nicht endlos wird.

### 5. Verfügbarkeit
- Termine als kompakte Karten mit großen Ja/Nein-Schaltflächen; Zeitfenster nur bei Bedarf aufklappbar.

### 6. Navigation
- Auf dem Handy eine feste untere Leiste mit vier Zielen: Start, Kurse, Verfügbarkeit, Mitglieder – so ist alles mit einem Tipp erreichbar.

## Technische Hinweise
- Neue Komponenten: `src/components/trainer/TrainerMobileNav.tsx`, `src/components/trainer/ParticipantCard.tsx`, `src/components/trainer/MemberCard.tsx`.
- Tabellen bleiben erhalten und werden per Tailwind-Breakpoint (`hidden md:block` / `md:hidden`) gegen die Kartenansicht getauscht – keine Datenlogik ändert sich.
- Betroffene Dateien: `src/routes/_authenticated/trainer/index.tsx`, `kurse.tsx`, `mitglieder.tsx`, `src/components/AttendanceBoard.tsx`, `src/components/trainer/AvailabilityBoard.tsx`, `src/routes/_authenticated/route.tsx` (nur Layout-Platz für die untere Leiste).
- Keine Änderungen an Rechten, Serverfunktionen, Excel-Export oder E-Mails.
