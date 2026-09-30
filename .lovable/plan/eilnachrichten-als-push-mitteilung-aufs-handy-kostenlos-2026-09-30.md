# Eilnachrichten als Push-Mitteilung aufs Handy (kostenlos)

Eltern erhalten Eilnachrichten zusätzlich zur E-Mail als Push-Mitteilung direkt auf dem Handy – ohne Konto, ohne Kosten, ohne dass Handynummern sichtbar werden.

## Für Eltern

1. Neue Seite **„Mitteilungen aktivieren“** (`/mitteilungen?token=…`), verlinkt per persönlichem Link aus E-Mails.
   - **Android/Chrome:** Knopf „Mitteilungen aktivieren“ → Browser fragt → fertig.
   - **iPhone:** Automatische Erkennung. Ist die Seite nicht vom Home-Bildschirm geöffnet, erscheint eine bebilderte 3-Schritte-Anleitung (Safari → Teilen → „Zum Home-Bildschirm“ → dort öffnen und aktivieren).
   - **Am PC:** Großer QR-Code mit Hinweis „Bitte mit dem Handy scannen“.
   - Testmitteilung nach Aktivierung; jederzeit abmeldbar.
2. Buchungsbestätigung und Wartelisten-Zusage bekommen einen Kasten „Notfall-Mitteilungen aufs Handy“ mit Link und iPhone-Hinweis („Ohne diese Schritte erhalten Sie nur E-Mails“).
3. Einmalige Info-Mail an alle bereits gebuchten Familien mit demselben Link und Hinweis.

## Für Vorstand und Trainer

- Die bestehende **Eilnachricht** sendet künftig automatisch E-Mail **und** Push an alle aktivierten Handys des Kurses. Der Dialog zeigt „X von Y Familien per Push erreichbar“.
- In der Kursverwaltung ein Knopf „Info-Mail zu Mitteilungen an alle gebuchten Familien senden“ (einmalig, doppelte Sendungen ausgeschlossen).

## Technische Umsetzung

- Neue Tabelle `push_subscriptions` (Teilnehmer-/Kurszuordnung, endpoint, Schlüssel, user_agent, Zeitstempel); Zugriff nur serverseitig (RLS ohne öffentliche Policies, Grants nur service_role).
- Persönlicher Link-Token je Buchung (`course_participants.push_token`), erzeugt bei Bedarf.
- VAPID-Schlüsselpaar als Geheimnisse (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`), einmalig generiert.
- Service Worker `public/sw.js` (push + notificationclick) und `public/manifest.webmanifest` (für iPhone-Home-Bildschirm), eingebunden im Root-Head.
- Push-Versand im Server mit WebCrypto (Worker-kompatibel, z. B. `@block65/webcrypto-web-push`); abgelaufene Abos (404/410) werden automatisch gelöscht.
- Server-Funktionen: `subscribePush`, `unsubscribePush` (token-basiert, öffentlich), Erweiterung von `broadcastCourseMessage`, `sendPushInviteMail` (Vorstand).
- Neue E-Mail-Vorlage `push-invite`; Hinweis-Kasten in `course-booking-confirmation`.
- QR-Code am PC über eine bestehende oder leichte QR-Bibliothek.

## Grenzen

- iPhone erst ab iOS 16.4 und nur nach „Zum Home-Bildschirm“.
- Wer nicht aktiviert, bekommt weiterhin nur die E-Mail.
