## Problem

Bei den öffentlichen Formularen (Kursanfrage/Warteliste, Mitgliedsantrag, Kontakt) passiert nach „Absenden" sichtbar nichts und die Anfrage taucht nicht im Admin-Panel auf.

## Ursache

Alle drei Formulare führen nach `insert` ein `.select("id, created_at").maybeSingle()` aus. Die RLS-Policies erlauben anonymen Besuchern nur INSERT, **nicht SELECT** (`Staff view requests` etc. sind auf `authenticated` + `is_staff` beschränkt). Damit liefert PostgREST nach erfolgreichem Insert einen RLS-Fehler beim Zurücklesen → `error` ist gesetzt → die Funktion bricht mit `toast.error` ab und das Bestätigungs-Dialogfenster (`setDone(true)`) wird nie ausgelöst. Je nach Race kann sogar der Insert komplett zurückrollen, sodass im Admin nichts erscheint.

Belege:
- `course_requests` Policies: nur `is_staff` darf SELECT, anon nur INSERT.
- `messages`, `memberships`: gleiches Muster.
- Datenbank zeigt nur 2 alte Einträge in `course_requests` (vermutlich durch eingeloggte Staff-Tests).

## Fix

Bei anonymen Inserts kein `.select()` anhängen. Stattdessen idempotency key clientseitig erzeugen und `created_at` lokal setzen. Damit gelingt der Insert ohne SELECT-Berechtigung, der Bestätigungsdialog erscheint, und die Admin-Benachrichtigung wird trotzdem in die Queue gestellt.

### Änderungen

1. **`src/routes/kurs-anfragen.tsx`** — `insert(...).select(...).maybeSingle()` ersetzen durch reines `insert(...)`. `idempotencyKey` aus `crypto.randomUUID()` und `created_at: new Date().toISOString()` an `notify-admin` übergeben.
2. **`src/routes/mitgliedschaft.tsx`** — gleicher Umbau am Insert-Aufruf.
3. **`src/routes/kontakt.tsx`** — gleicher Umbau am Insert-Aufruf.
4. **Diagnose-Log** — bei `error` einmalig `console.warn` mit Code/Message, damit zukünftige RLS-Probleme im Browser-Log sichtbar sind (nicht nur generischer Toast).

Keine Änderung an Policies, kein neues Backend, keine UI-Änderungen außer der bereits vorhandenen Erfolgsdialoge — die feuern danach zuverlässig.

## Verifikation

- Im Inkognito-Modus jedes der drei Formulare ausfüllen → Bestätigungsdialog erscheint.
- `SELECT count(*)` auf `course_requests`, `messages`, `memberships` zeigt die neuen Zeilen.
- `email_send_log` enthält `pending`/`sent` für `course-request`, `contact-message`, `membership-application`.
