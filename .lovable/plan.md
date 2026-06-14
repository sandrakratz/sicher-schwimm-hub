## Ziel
Alle Zeitstempel (Eingangszeiten, Tabellen, E-Mail-Templates) werden in **Europe/Berlin** (inkl. Sommerzeit) angezeigt. Die Datenbank speichert weiterhin UTC (Standard, korrekt) — geändert wird nur die **Anzeige-Zeitzone**.

## Vorgehen

1. **Neues Helper-Modul `src/lib/format.ts`**
   - `formatDateBerlin(iso)` → `dd.MM.yyyy` in `Europe/Berlin`
   - `formatDateTimeBerlin(iso)` → `dd.MM.yyyy, HH:mm` in `Europe/Berlin`
   - Beide via `toLocaleString('de-DE', { timeZone: 'Europe/Berlin', ... })`, null-/fehlertolerant.

2. **Alle Anzeige-Stellen umstellen** auf die Helper:
   - Admin: `anfragen.tsx`, `audit.tsx`, `benutzer.tsx`, `events.tsx`, `dokumente.tsx`, `news.tsx`, `nachrichten.tsx`, `mitgliedschaften.tsx`, `kurse.tsx`
   - Portal: `index.tsx`, `news.tsx`, `dokumente.tsx`, `kurse.tsx`
   - Öffentlich: `routes/news.tsx`
   - E-Mail-Templates: `contact-message.tsx`, `course-request.tsx`, `new-registration.tsx`, `membership-application.tsx`, `course-assignment.tsx`

3. **Nicht angefasst:**
   - DB-Schema / `created_at` (bleibt `timestamptz` UTC — Best Practice).
   - `src/components/ui/*` (generische Komponenten, keine Anwendungs-Datumsanzeige).

## Ergebnis
Eingangszeiten von Kurs- und Wartelistenanfragen, Nachrichten, Mitgliedsanträgen etc. werden im Admin-Panel und in den Benachrichtigungs-E-Mails konsistent in Berliner Zeit (MEZ/MESZ automatisch) dargestellt.