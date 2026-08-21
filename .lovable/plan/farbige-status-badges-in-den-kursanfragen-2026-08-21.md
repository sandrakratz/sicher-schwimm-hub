# Farbige Status-Badges in den Kursanfragen

Die Status-Einträge in der Kursanfragen-Übersicht werden farbig dargestellt, damit Handlungsbedarf sofort erkennbar ist.

## Farben

- Neu — grün
- Warteliste — gelb
- Kontaktiert — blau
- In Prüfung — orange
- Akzeptiert — dunkelgrün/Teal
- Abgelehnt — rot

Die Farben gelten sowohl in der Tabelle (Spalte „Status") als auch im Detail-Dialog, damit die Ansicht einheitlich bleibt.

## Technisches

Datei: `src/routes/_authenticated/admin/anfragen.tsx`

- `STATUS_LABEL` wird um eine Farbzuordnung ergänzt (Label + Badge-Klassen) und eine kleine lokale Komponente `StatusBadge` gerendert.
- Beide bisherigen Stellen (`Zeile 273` Tabelle, `Zeile 331` Detail-Dialog) nutzen künftig `StatusBadge` statt `Badge variant="outline"`.
- Reine Darstellungsänderung, keine Logik-, Daten- oder Backend-Änderungen.
