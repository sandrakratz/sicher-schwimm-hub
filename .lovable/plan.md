# Umfrage zu Terminen: Wer hilft mit – und von wann bis wann?

Ziel: Für einen Termin (z. B. Erste-Hilfe-Stand) direkt eine Abfrage unter den Trainer:innen starten. Jede:r trägt ein, ob sie/er helfen kann und in welchem Zeitfenster. Du siehst auf einen Blick, ob der Stand durchgängig besetzt ist.

## Ablauf

1. In der Eventverwaltung gibt es beim Termin einen Schalter „Helfer-Umfrage aktivieren“ (optional mit Hinweistext, z. B. „Bitte Zeitfenster eintragen, Schichten mind. 2 Std.“).
2. Trainer:innen sehen den Termin unter „Verfügbarkeit“ in einem neuen Abschnitt „Termine & Helfer-Einsätze“ und können:
   - „Ich helfe“ / „Ich kann nicht“ wählen,
   - bei Zusage ein oder mehrere Zeitfenster (von–bis) eintragen, innerhalb der Termindauer,
   - eine kurze Notiz ergänzen (z. B. „nur bis 14 Uhr sicher“).
3. In der Eventverwaltung öffnet ein Button „Helfer (3)“ eine Übersicht mit:
   - Liste aller Rückmeldungen (Name, Zeitfenster, Notiz, Zusage/Absage),
   - einer einfachen Zeitleiste über die Termindauer, die zeigt, wie viele Helfer je Stunde da sind,
   - deutlicher Markierung von Lücken („Nicht besetzt: 12:00–13:00“),
   - Liste der Trainer:innen ohne Rückmeldung.
4. Trainer:innen können ihre Zusage jederzeit ändern; du kannst als Admin Einträge korrigieren oder löschen.

Zusatz: Zugesagte Zeitfenster lassen sich – wie bei den Kursterminen – als Kalenderdatei (.ics) exportieren.

## Technische Umsetzung

- Neue Tabelle `public.event_shift_signups`: `event_id`, `trainer_id`, `available` (bool), `starts_at`, `ends_at` (beide optional; leer = ganzer Zeitraum), `note`, Zeitstempel. Mehrere Zeilen pro Trainer:in und Termin erlaubt.
  - GRANTs für `authenticated`/`service_role`; RLS: Trainer:innen dürfen eigene Zeilen lesen/schreiben/löschen, `is_staff()` darf alles; Lesen zusätzlich für alle Trainer:innen des Termins, damit die Abdeckung sichtbar ist.
- Neue Spalten auf `public.events`: `signup_enabled` (bool, default false), `signup_note` (text).
- Frontend:
  - `src/routes/_authenticated/admin/events.tsx`: Schalter + Hinweistext im Event-Dialog, Spalte „Helfer“, neuer Auswertungs-Dialog mit Zeitleiste/Lückenberechnung.
  - `src/routes/_authenticated/admin/verfuegbarkeit.tsx`: neuer Abschnitt für kommende Termine mit aktivierter Umfrage inkl. Zeitfenster-Eingabe.
  - Neue Hilfsdatei `src/lib/event-shifts.ts` für Abdeckungs-/Lückenberechnung; ICS-Export über bestehendes `src/lib/ics.ts`.
- Sichtbarkeit: Umfrage nur für Rollen `trainer`, `board`, `admin`; öffentliche Events bleiben davon unberührt.
