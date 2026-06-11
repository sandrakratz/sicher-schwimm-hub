# Admin-E-Mails für alle Eingänge

## Status heute

| Ereignis | E-Mail an info@sicher-schwimmen.com? |
|---|---|
| Kursanfrage (`/kurs-anfragen`) | ✅ ja (`course-request`) |
| Mitgliedsantrag (`/mitgliedschaft`) | ✅ ja (`membership-application`) |
| Kontaktnachricht (`/kontakt`) | ❌ **nein** – wird nur in DB gespeichert |
| Neuregistrierung (Konto anlegen `/auth`) | ❌ **nein** |

Die ersten beiden funktionieren also bereits. Fehlend sind **Kontakt** und **Registrierung**.

## Was ich umsetzen würde

### 1. Neue E-Mail-Vorlage „Kontaktnachricht"
- Datei `src/lib/email-templates/contact-message.tsx` (Empfänger fest auf info@sicher-schwimmen.com, Betreff „Neue Kontaktnachricht – {Name}")
- Inhalt: Name, E-Mail, Kategorie, Betreff, Nachricht, Zeitstempel
- Registrierung in `src/lib/email-templates/registry.ts`
- `src/routes/kontakt.tsx`: nach erfolgreichem Insert in `messages` → `fetch('/api/public/notify-admin', { templateName: 'contact-message', … })`

### 2. Neue E-Mail-Vorlage „Neue Registrierung"
- Datei `src/lib/email-templates/new-registration.tsx` (Empfänger fest auf info@sicher-schwimmen.com)
- Inhalt: Name, E-Mail, Zeitpunkt
- Registrierung in `registry.ts`
- Trigger in `src/routes/auth.tsx` direkt nach erfolgreichem `signUp`-Aufruf → `fetch('/api/public/notify-admin', …)` mit Idempotenzschlüssel `signup-{userId}`

### Hinweise
- Das bestehende öffentliche Endpoint `/api/public/notify-admin` kann unverändert genutzt werden – es akzeptiert nur Templates mit fest gesetztem `to`, also kein Missbrauchsrisiko.
- Absender bleibt „Sicher Schwimmen e.V. <noreply@notify.sicher-schwimmen.com>".
- Keine Backend-/DB-Trigger nötig; alles läuft über die vorhandene Queue.

## Offene Frage
Soll die Registrierungs-E-Mail **bei jedem** neuen Konto rausgehen, oder nur wenn jemand zusätzlich einen Mitgliedsantrag/Kursanfrage stellt? (Eltern, die ihr Kind nur einem Kurs zuordnen, legen ja auch ein Konto an.)
