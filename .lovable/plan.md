# Plan: Vier offene Punkte beheben

## 1. Bestätigungs-Dialog nach Formularversand (Kontakt, Mitgliedsantrag, Kursanfrage)

Die Formulare funktionieren bereits ohne Login (RLS-Policies erlauben `anon` INSERT auf `messages`, `memberships`, `course_requests`). Aktuell wird nach erfolgreichem Versand nur die Karte ausgetauscht — der Nutzer übersieht das leicht.

Änderung: einen modalen Dialog (`AlertDialog` aus `@/components/ui/alert-dialog`) öffnen, sobald `done = true`. Inhalt jeweils:

- **Kontakt** (`src/routes/kontakt.tsx`): „Vielen Dank! Ihre Nachricht ist bei uns eingegangen und wird von unserem Team bearbeitet. Wir melden uns so schnell wie möglich."
- **Mitgliedsantrag** (`src/routes/mitgliedschaft.tsx`): „Ihr Mitgliedsantrag ist eingegangen. Er wird vom Vereinsvorstand geprüft. Sie erhalten eine Rückmeldung per E-Mail."
- **Kursanfrage / Warteliste** (`src/routes/kurs-anfragen.tsx`): „Ihre Kursanfrage ist eingegangen und wird bearbeitet. Wir melden uns mit den nächsten Schritten."

Dialog enthält einen „OK / Zur Startseite"-Button. Bestehende Inline-Erfolgskarten bleiben als Fallback nach Dialog-Close stehen.

## 2. Bestätigungs-Dialog nach Registrierung

In `src/routes/auth.tsx` nach erfolgreichem `supabase.auth.signUp`: gleichen `AlertDialog` zeigen mit Text „Ihre Registrierung ist vorgemerkt und wird durch einen Administrator freigeschaltet. Sie erhalten eine E-Mail, sobald Ihr Konto aktiv ist." Erst nach Klick auf „OK" wird auf den Login-Tab gewechselt.

## 3. Admin-Benachrichtigungs-E-Mails reparieren

**Ursache:** Im `email_send_log` schlagen alle Admin-Mails (Templates `new-registration`, `membership-application`, künftig `contact-message`, `course-request`) mit `400 missing_unsubscribe — Transactional emails must include an unsubscribe_token` fehl. Die Datei `src/routes/api/public/notify-admin.ts` legt die Nachricht in die Queue, ohne vorher einen Unsubscribe-Token zu erzeugen.

**Fix:** `notify-admin.ts` analog zu `src/routes/lovable/email/transactional/send.ts` erweitern:
1. Empfänger `template.to` normalisieren.
2. `suppressed_emails` prüfen (fail-closed).
3. Vorhandenen Token in `email_unsubscribe_tokens` lesen oder per `upsert` neu anlegen.
4. `unsubscribe_token` im Queue-Payload mitliefern.

Damit gehen Mails an `info@sicher-schwimmen.com` für Kontaktnachrichten, Kursanfragen, Mitgliedsanträge und Neuregistrierungen wieder raus. Push-Nachrichten benötigen zusätzliche Infrastruktur (Service Worker + Web-Push-Subscription, FCM-Setup), deshalb bleibt es bei der einfacheren E-Mail-Lösung — falls Push gewünscht ist, separat planen.

Verifizieren: nach Deploy einen Testkontakt absenden und `SELECT … FROM email_send_log ORDER BY created_at DESC LIMIT 3` prüfen — Status `sent` erwartet.

## 4. Beschriftung im Admin-Dashboard

In `src/routes/_authenticated/admin/index.tsx` Zeile 28: Label `"Aktive Mitglieder"` → `"Aktive Benutzer"`. Sonst keine Änderung; die Stat-Quelle (`stats.members`) bleibt.

## Technische Details

- Neue Datei nicht nötig — `AlertDialog` ist bereits installiert (`src/components/ui/alert-dialog.tsx`).
- `notify-admin.ts` darf `crypto.getRandomValues` verwenden (in Worker-Runtime verfügbar).
- Keine Migration nötig (RLS- und Storage-Policies sind unverändert).
- `templateData` für `contact-message` und `course-request` müssen die jeweiligen Felder unverändert beibehalten.
