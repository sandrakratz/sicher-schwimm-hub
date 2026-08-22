# Markierung „An Schwimmschule Sharky verwiesen“

In der Kursanfragen-Übersicht lässt sich jede Anfrage per Klick als „an Schwimmschule Sharky verwiesen“ markieren – sichtbar durch einen farbigen Button/Badge.

## Verhalten

- Neue Spalte „Sharky“ in der Tabelle: farbiger Button.
  - Nicht markiert: neutraler, ausgegrauter Umriss-Button „Sharky“.
  - Markiert: kräftig eingefärbter Badge-Button (violett/lila, klar unterscheidbar von den bestehenden Status-Farben) mit Häkchen.
- Klick schaltet die Markierung sofort um (auch direkt in der Tabelle, ohne Detail-Dialog zu öffnen).
- Im Detail-Dialog derselbe Umschalter als eigene Zeile.
- Die Markierung ist unabhängig vom Status – eine verwiesene Anfrage kann weiterhin z. B. „Warteliste“ sein.

## Technisches

- Datenbank: neues Feld `referred_sharky` (boolean, Standard `false`) sowie `referred_sharky_at` (Zeitstempel) in `course_requests`; Migration inkl. bestehender Zugriffsregeln (nur Team-Rollen dürfen ändern).
- `src/routes/_authenticated/admin/anfragen.tsx`: Feld im Typ ergänzen, Spalte „Sharky“ mit Toggle-Button, Zeile im Detail-Dialog, optimistisches Update des lokalen States nach dem Speichern.
- Keine Änderungen an E-Mails, Zuweisungen oder Statuslogik.
