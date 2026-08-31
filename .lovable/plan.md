# Warteliste & Sperrliste: schlank halten statt umbauen

## Antwort vorab: Der große Umbau lohnt sich nicht

Die Buchungsbelege aus Wartelisten-Zusagen sind für dich unsichtbar (nur im Archiv „Kursanfragen“) und halten intern die Verbindung Teilnehmer ↔ Originaldaten ↔ E-Mail-Verlauf. Sie zu entfernen bringt keine Übersichtlichkeit, kostet aber Risiko. Empfehlung: so lassen, stattdessen die drei Punkte umsetzen, die dir im Alltag wirklich helfen.

## 1. Sperrliste bei Nichtzahlung (Standard: ja)

Heute setzt „Teilnehmer entfernen“ den Eintrag nur auf „Abgesagt“ – ohne Sperrliste. Automatisch kommen nur abgelehnte Kursanfragen auf die Liste.

Neu: Beim Entfernen eines Teilnehmers öffnet sich ein kleiner Dialog:
- Grund auswählen (Nichtzahlung / Rücktritt Eltern / Sonstiges + Freitext)
- Checkbox „Auf Sperrliste setzen“ — vorausgewählt, wenn der Teilnehmer nicht als bezahlt markiert ist; der Admin kann sie abwählen
- Bei Aktivierung wird ein Sperrlisteneintrag mit Kindname, Geburtsdatum, E-Mail und Grund angelegt (rücknehmbar unter Sperrliste)
- Gleiche Option beim Wartelisten-Status „Als abgemeldet markieren“ (dort standardmäßig aus)

## 2. Anfragen einsehen und ergänzen

Der Detail-Dialog in der Warteliste zeigt die Originalanfrage bisher nur lesend. Neu:
- Bearbeiten-Modus für alle Felder: Kindname, Geburtsdatum, Elternname, E-Mail, Telefon, Mitglied ja/nein, Schwimmniveau/Wunsch, Gesundheitshinweise
- Freitextfeld „Interne Notizen“ direkt im Dialog (mit Zeitstempel-Verlauf statt Überschreiben)
- Änderungen werden im Wartelisteneintrag gespeichert und in der Übersicht sofort sichtbar
- Kennzeichnung „unvollständig“, wenn Pflichtangaben (Geburtsdatum, Telefon) fehlen — damit du siehst, wo nachgefasst werden muss

## 3. Damit es rund läuft (kleine Lücken schließen)

- Abgelaufene Platzangebote: Angebote, deren Frist verstrichen ist, automatisch zurücksetzen und den nächsten Platz vergeben, statt dass der Platz hängen bleibt
- Sperrlisten-Treffer sichtbar machen: Warnhinweis in der Warteliste, wenn Kind/E-Mail gesperrt ist (blockiert wird die Anmeldung bereits)
- Dublettenwarnung: gleiches Kind/E-Mail mehrfach in der Warteliste wird markiert, statt still doppelt zu laufen
- Übersicht schlank: Menüpunkt „Kursanfragen (Archiv)“ nur noch für Admins sichtbar

## Technische Umsetzung

- `src/lib/blocklist.functions.ts`: bestehende `addBlocklistEntry` aus dem Entfernen-Flow aufrufen
- `src/routes/_authenticated/admin/kurse.tsx`: Entfernen-Dialog statt `confirm()`; neue Serverfunktion `removeParticipant({ participantId, reason, blocklist })` (ersetzt das reine Status-Update, protokolliert per `logAudit`)
- `src/lib/waitlist.functions.ts`: `updateWaitlistEntry` um Personen-/Kontaktfelder und Notizverlauf erweitern; neue `expireWaitlistOffers` (Aufruf beim Öffnen der Warteliste und über den bestehenden Cron)
- `src/components/admin/WaitlistAdmin.tsx`: `OriginalRequestDialog` um Bearbeiten-Modus, Notizfeld, Vollständigkeits- und Sperrlisten-Hinweise erweitern
- `src/lib/nav-items.ts`: Archiv-Punkt auf Admin-Rolle beschränken
- Keine Schemaänderung nötig außer optional `waitlist_entries.notes_log` (jsonb) für den Notizverlauf
