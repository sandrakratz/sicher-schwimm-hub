## Ziel
Alle über die Webseite versandten E-Mails (Antworten auf Nachrichten, Rückfragen zu Kursanfragen, Kurszuweisungen, Widerrufsbestätigungen, Admin-Benachrichtigungen etc.) sollen im Adminbereich mit vollem Inhalt nachlesbar sein.

## Umsetzung

### 1. Vollen Inhalt speichern
Aktuell speichert `email_send_log` nur `template_name`, `recipient_email`, `status` und `error_message` — nicht Betreff/Body. Damit man nachlesen kann, was besprochen wurde, brauchen wir den Inhalt.

- Migration: neue Spalten `subject text`, `body_text text`, `body_html text`, `sender_user_id uuid` in `email_send_log` ergänzen (nullable, keine Änderung an bestehendem Queue-Flow).
- In den beiden manuell versandten Reply-Funktionen den Inhalt beim `pending`-Insert mitschreiben:
  - `src/lib/messages.functions.ts` (`replyToMessage`)
  - `src/lib/course-requests.functions.ts` (`replyToCourseRequest`)
- Für später automatisch versandte Templates (Kurszuweisung, Widerruf, Admin-Notify usw.) optional in einem Folgeschritt — wir starten mit den beiden „Gespräch"-Fällen, weil dort der Nachlese-Bedarf entsteht.

### 2. Neue Adminseite „Gesendete E-Mails"
Neue Route `src/routes/_authenticated/admin/emails.tsx`, Zugriff für `admin` + `board` (Guard wie `nachrichten.tsx`).

Features (folgt dem Email-Dashboard-Standard):
- Zeitraum-Filter (24h / 7 Tage / 30 Tage / custom), Default 7 Tage.
- Filter nach Template (Dropdown mit distinct `template_name`).
- Statusfilter (Alle / Gesendet / Fehlgeschlagen / Unterdrückt) mit farbigen Badges.
- Summary-Cards: Gesamt, Gesendet, Fehlgeschlagen, Unterdrückt — dedupliziert per `message_id`.
- Tabelle: eine Zeile pro E-Mail (dedupliziert, letzter Status pro `message_id`), Spalten Template, Empfänger, Status, Zeit (Europe/Berlin via `formatDateTimeBerlin`), Aktion „Ansehen".
- „Ansehen"-Dialog zeigt Betreff, Empfänger, Zeitpunkt, gerenderten HTML-Body (sicher in Sandbox-`iframe` mit `srcDoc`) plus Text-Fallback und ggf. Fehlermeldung.
- Paginierung ab 50 Einträgen, Standardsortierung Zeit absteigend.

### 3. Verlinkung im Kontext
- In `admin/nachrichten.tsx`: pro Nachricht Link „Gesendete Antworten anzeigen" → filtert die Emailseite auf Empfänger.
- In `admin/anfragen.tsx`: im Detail-Dialog analoger Link.

### 4. Sichtbarkeit / RLS
`email_send_log` hat bereits Policies; Lesezugriff für `admin`/`board` prüfen und ggf. per neuer Policy freigeben (nur SELECT, kein INSERT/UPDATE für Nutzer).

## Nicht im Scope
- Keine Änderung am Queue-/Sende-Flow selbst.
- Keine Rendering-Kopien für Auth-Mails (Passwort-Reset etc.) — diese enthalten Tokens und werden weiterhin nur mit Status geloggt.
- Keine Volltextsuche (kann später ergänzt werden).
