# Kursanfragen: zugewiesene Anfragen in eigenem Reiter

Zugewiesene Kinder verschwinden aus der Liste der offenen Anfragen und erscheinen stattdessen in einem zweiten Reiter innerhalb derselben Kursgruppe.

## Aufbau je Kursgruppe (z. B. „Seepferdchen“)

```text
Seepferdchen  [3 | 5]
  ├─ Aktuelle Anfragen (3)      Datum · Eltern · Kind · Kurs · Status
  └─ Zugewiesene Anfragen (5)   Datum · Eltern · Kind · Zugewiesener Kurs (Name + Kursbeginn) · Status
```

- Aufteilung nach `assigned_course_id`: gesetzt = zugewiesen, leer = aktuelle Anfrage.
- Im Reiter „Zugewiesene Anfragen“ ersetzt die Spalte „Kurs“ den Wunschkurs durch den tatsächlichen Kurs: Kursname plus Kursbeginn (Datum, deutsches Format) und, falls vorhanden, das Enddatum.
- Beide Reiter öffnen per Klick weiterhin denselben Detail-Dialog.
- Die Anzahl-Badges an der Kursgruppe zeigen beide Zahlen; Gruppen ohne Einträge in einem Reiter zeigen dort einen kurzen Hinweistext.
- Im Detail-Dialog wird bei zugewiesenen Anfragen der zugewiesene Kurs mit Datum als eigene Zeile angezeigt.

## Technische Details

Datei: `src/routes/_authenticated/admin/anfragen.tsx`

- `load()` lädt zusätzlich eine Kurs-Lookup-Liste ohne `archived_at`-Filter (`id, name, starts_on, ends_on`), damit auch archivierte zugewiesene Kurse benannt werden können. Die bestehende Auswahl-Liste für das Einbuchen bleibt unverändert (weiterhin nur aktive Kurse).
- Gruppierung wie bisher über `groupKeyFor(desired_course)`, danach Split in `open` / `assigned`.
- Innerhalb jedes `AccordionContent` ein `Tabs`-Element (shadcn) mit den beiden Reitern; die gemeinsame Tabellenlogik wird in eine lokale Komponente ausgelagert, die eine Spaltenvariante („Wunschkurs“ vs. „Zugewiesener Kurs“) erhält.
- Datumsformatierung über `formatDateBerlin` aus `@/lib/format`.
