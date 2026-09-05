# Teilnehmer-Nummern (Material 1–10) im Trainerbereich

Ziel: Jedes Kind hat im Trainerbereich dieselbe Nummer wie in der Excel-Kursliste, damit das nummerierte Material (Gurte 1–10) eindeutig zugeordnet werden kann.

## Wie nummeriert wird

Genau wie in der Excel-Liste: alle bestätigten Teilnehmenden eines Kurses werden nach Name (deutsche Sortierung) sortiert und fortlaufend ab 1 durchnummeriert. So stimmen Papierliste und Handyansicht immer überein.

## Wo die Nummer erscheint

- Anwesenheitserfassung (Handy-Karten und Tabelle): kleine Nummer direkt vor dem Namen
- Teilnehmerliste auf dem Handy: Nummer vor dem Namen
- Teilnehmertabelle am Desktop: eigene schmale Spalte „Nr.“ ganz links

Darstellung: dezentes kleines Kästchen mit der Zahl, gut lesbar, nimmt kaum Platz weg.

## Technische Umsetzung

- `src/lib/trainer-belt-no.ts` (neu): Hilfsfunktion, die aus der Teilnehmerliste eine Map `participantId -> Nr.` erzeugt (nur `status === "confirmed"`, sortiert per `localeCompare(..., "de")`) — identisch zur Logik in `generateCourseListXlsx`.
- `src/routes/_authenticated/trainer/kurse.tsx`: Map je Kurs berechnen, `no` an `AttendanceBoard`-Teilnehmer übergeben, `no` an `ParticipantCard` übergeben, Spalte „Nr.“ in der Desktop-Tabelle ergänzen.
- `src/components/trainer/ParticipantCard.tsx`: optionales `no`-Feld, Anzeige über die vorhandene Badge-Optik.
- `src/components/AttendanceBoard.tsx`: bestehende `BeltNo`-Komponente in Handy-Karten und Desktop-Tabelle vor dem Namen rendern.

Keine Änderungen an Datenbank, Rechten, E-Mails oder dem Excel-Export.
