# Sperrliste (Blacklist) für Kursbuchungen

Ziel: Teilnehmer, deren Kursanfrage abgelehnt wurde, können auf der Webseite keinen Kurs mehr direkt verbindlich buchen. Sie können nur noch eine Anfrage stellen, über die der Vorstand einzeln entscheidet.

## Funktionsweise

- **Neue Sperrliste** mit Einträgen aus zwei Quellen:
  - automatisch, sobald eine Kursanfrage im Adminbereich auf „Abgelehnt“ gesetzt wird (Kind: Name + Geburtsdatum, sowie Eltern-E-Mail)
  - manuell durch Vorstand/Admin (eintragen, Grund erfassen, wieder entfernen)
- **Treffer-Logik:** gesperrt, wenn entweder die Eltern-E-Mail übereinstimmt ODER Kindname + Geburtsdatum übereinstimmen (Groß-/Kleinschreibung und Leerzeichen egal).
- **Wird eine Ablehnung zurückgenommen** (Status wieder auf aktiv/zugewiesen), wird der automatische Eintrag wieder deaktiviert.

## Was Eltern auf der Webseite sehen

Auf der Kursdetailseite:
1. Formular wird zunächst wie bisher ausgefüllt.
2. Beim Absenden prüft der Server die Sperrliste.
3. Bei Treffer: keine Buchung, stattdessen ein deutlicher Hinweis
   („Für diese Anmeldung ist eine Einzelfallprüfung durch den Vorstand erforderlich. Bitte stellen Sie eine Kursanfrage – wir melden uns persönlich bei Ihnen.“)
   und direkte Weiterleitung in das Anfrageformular mit bereits übernommenen Daten.
4. Die Anfrage landet im Adminbereich wie eine normale Kursanfrage, zusätzlich mit Kennzeichnung „Sperrliste – Einzelfallprüfung“.

Es entstehen dabei keine Buchungsbestätigung, keine Dokument-Nr. und keine Zahlungsaufforderung.

## Adminbereich

- Neuer Reiter/Bereich **„Sperrliste“** (nur Admin/Vorstand): Liste mit Kind, Geburtsdatum, E-Mail, Grund, Quelle (automatisch/manuell), Datum, Aktion „Entfernen“.
- Manuelles Hinzufügen über ein kleines Formular.
- In der Anfragen-Ansicht: Badge „Gesperrt“ bei betroffenen Anfragen; beim Ablehnen ein Hinweis, dass der Eintrag automatisch in die Sperrliste wandert (mit optionalem Grund).
- Buchen/Einbuchen durch den Vorstand bleibt jederzeit möglich – die Sperre betrifft nur die Selbstbuchung über die Webseite.

## Technische Umsetzung

1. **Migration**: Tabelle `public.booking_blocklist`
   - Felder: `child_name_norm`, `child_dob`, `email_norm`, `reason`, `source` ('auto_rejected' | 'manual'), `request_id` (optional), `active`, `created_by`, Zeitstempel + Update-Trigger
   - GRANTs: `authenticated` (SELECT), `service_role` (ALL); kein `anon`-Zugriff
   - RLS: Lesen/Schreiben nur für `is_staff()`; Prüfung im Buchungsfluss läuft über den Service-Role-Client
   - Trigger auf `course_requests`: bei Wechsel nach `rejected` Eintrag anlegen/aktivieren, bei Wechsel weg von `rejected` deaktivieren
   - Backfill bestehender abgelehnter Anfragen
2. **`src/lib/courses-public.functions.ts`**: in `bookCourse` vor dem Anlegen des Teilnehmers Sperrliste per Service-Role prüfen; bei Treffer strukturierte Antwort `{ blocked: true }` statt Buchung zurückgeben (kein Teilnehmer, keine E-Mail, keine Dokument-Nr.).
3. **`src/routes/kurse_.$slug.tsx`**: Antwort `blocked` abfangen, Hinweisdialog anzeigen und in den Anfrageflow mit vorbefüllten Daten wechseln (Anfrage wird mit Vermerk gespeichert).
4. **Neue Verwaltung**: `src/lib/blocklist.functions.ts` (Liste, hinzufügen, entfernen – jeweils mit `is_staff`-Prüfung und Audit-Log) und Anbindung im Adminbereich (`src/routes/_authenticated/admin/anfragen.tsx` bzw. eigener Reiter).
