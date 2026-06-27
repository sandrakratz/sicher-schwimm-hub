## Ziel
Kursanfragen im Admin-Bereich nach Kursart gruppiert in einklappbaren Sektionen anzeigen, in fester Reihenfolge.

## Reihenfolge der Gruppen
1. Wassergewöhnung
2. Schwimmen lernen
3. Seepferdchen-Vorbereitung
4. Seepferdchen
5. Bronze
6. Silber
7. Gold
8. Sonstige / Unbekannt (für nicht zuordenbare Wünsche)

Hinweis: Du hast „Wassergewöhnung" am Ende genannt — ich habe es nach oben gestellt, weil das didaktisch der erste Schritt ist. Sag Bescheid, wenn es doch unten bleiben soll.

## Umsetzung in `src/routes/_authenticated/admin/anfragen.tsx`
- Tabellen-Sortierung entfernen, stattdessen Anfragen client-seitig in die definierte Reihenfolge mappen (Fuzzy-Match auf `desired_course`, z.B. „seepferdchen-vorbereitung" vor „seepferdchen" prüfen; Groß/Kleinschreibung & Bindestriche egal).
- Jede Gruppe als eigenes ausklappbares Panel (shadcn `Accordion`, `type="multiple"`, alle Gruppen mit Treffern standardmäßig offen).
- Im Akkordeon-Header: Kursname + Badge mit Anzahl der Anfragen.
- Innerhalb jeder Gruppe die bestehende Tabelle (Datum, Eltern, Kind, Kurs, Status, Aktion) – Sortierung pro Gruppe: neueste zuerst.
- Leere Gruppen werden nicht angezeigt.
- Dialog (Details/Einbuchen) bleibt unverändert.

## Nicht im Scope
- Keine Änderungen am Datenmodell, an Server-Funktionen oder am Einbuchen-Dialog.
