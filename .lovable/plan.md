## Ziel

In den Detailansichten von **Nachrichten** und **Kursanfragen** soll die vollständige E-Mail-Konversation direkt sichtbar sein – die ursprüngliche Anfrage plus alle bisher und künftig versendeten Antworten, chronologisch sortiert.

## Umsetzung

### 1. Datenquelle
Alle Antworten liegen bereits in `email_send_log` (nach den letzten Änderungen mit `subject`, `body_html`, `body_text`, `sender_user_id`). Zuordnung per `recipient_email`:
- **Nachrichten**: `messages.from_email` → `email_send_log.recipient_email` mit `template_name = 'message-reply'`
- **Kursanfragen**: `course_requests.parent_email` → `email_send_log.recipient_email` mit `template_name = 'course-request-reply'`

Keine Schema-Änderung nötig – die Verknüpfung erfolgt über E-Mail-Adresse + Template.

### 2. Server-Funktionen (neu)
`src/lib/conversation.functions.ts` mit zwei Funktionen (Staff-only via `requireSupabaseAuth` + `has_role`):
- `getMessageConversation({ messageId })` → lädt die Nachricht + alle `message-reply`-Einträge an dieselbe Absender-Adresse (neueste zuletzt), inkl. Betreff, Zeitstempel, Status, Body.
- `getCourseRequestConversation({ requestId })` → analog für `course-request-reply` an `parent_email`.

Damit ältere Antworten ohne gespeicherten Text (vor der Logging-Änderung) sinnvoll dargestellt werden, wird der Hinweis „Antworttext nicht mehr verfügbar" angezeigt, wenn `body_html`/`body_text` leer sind – der Backfill (falls ausgeführt) füllt sie mit Kontext-Nachbildung.

### 3. UI: Konversations-Verlauf im Detail-Dialog

In `src/routes/_authenticated/admin/nachrichten.tsx` und `src/routes/_authenticated/admin/anfragen.tsx`:
- Neuer Abschnitt **„Verlauf"** im Detail-Dialog (über dem Antwortformular).
- Chronologische Timeline:
  - Erster Eintrag: die ursprüngliche Anfrage/Nachricht (mit „Eingegangen am …").
  - Danach jede Antwort als Karte mit: Datum, Betreff, Status-Badge (gesendet/pending/fehlgeschlagen), aufklappbarer Body (Text-Vorschau, „HTML anzeigen"-Button öffnet Sandbox-iframe wie in `/admin/emails`).
- Automatisches Reload nach dem Versand einer neuen Antwort, damit sie sofort im Verlauf erscheint.

### 4. Was NICHT geändert wird
- Kein neues Schema, keine neuen Spalten.
- Keine Änderung an bestehender `/admin/emails`-Seite (bleibt als globale Übersicht).
- Kein Merge mit externen Antworten (nur die über die Website versendeten sind erfasst).

## Technisch

- Neue Datei: `src/lib/conversation.functions.ts`
- Bearbeitet: `src/routes/_authenticated/admin/nachrichten.tsx`, `src/routes/_authenticated/admin/anfragen.tsx`
- RLS/Grants: `email_send_log` hat bereits Staff-Read-Policy – keine Änderung nötig.
