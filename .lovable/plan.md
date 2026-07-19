## Ziel
- Option 3: Alle künftig versandten App-E-Mails speichern Betreff + HTML + Textinhalt in `email_send_log`, damit sie im Adminbereich vollständig nachlesbar sind.
- Option 2: Für die Altbestände, bei denen wir die Quelldaten noch haben, die Inhalte einmalig aus den ursprünglichen Templates rekonstruieren.

## Option 3 – Ab jetzt vollständig loggen
Zentraler Punkt ist der Sende-Choke-Point. Zusätzlich zu den bereits erledigten Reply-Funktionen erweitern wir:

1. **`src/routes/lovable/email/transactional/send.ts`** – beim `pending`-Insert (Zeile 269) `subject`, `body_html`, `body_text` mitschreiben. Betroffen sind damit automatisch: `course-assignment`, `cancellation-confirmation`, `membership-application`-Bestätigungen etc. (alles was den generellen Sende-Weg nutzt).
2. **`src/routes/api/public/notify-admin.ts`** – analog beim Insert des Log-Eintrags Betreff und gerenderten HTML/Text ergänzen. Damit werden alle Admin-Benachrichtigungen (Kontakt, Kursanfrage, Mitgliedsantrag, Neuregistrierung) inhaltlich gespeichert.
3. **`src/routes/api/public/submit-cancellation.ts`** – für die intern und an den Nutzer versendete Widerrufs-Mail gleichermaßen.
4. **`src/lib/course-assignment.functions.ts`** – falls dort direkt in `email_send_log` geschrieben wird, ebenfalls Inhalte mitspeichern.

Bewusst **nicht** eingebunden:
- Auth-Mails (`src/routes/lovable/email/auth/webhook.ts`): enthalten Einmal-Tokens und dürfen nicht persistiert werden.
- Queue-Prozessor & Suppression-Route: schreiben nur Statusänderungen, keine neuen Templates.

## Option 2 – Einmalige Rekonstruktion von Altbeständen
Ein neuer Server-Endpunkt (Admin-only Button in `/admin/emails`), der einmalig ausgeführt wird und pro Alt-Zeile in `email_send_log` — sofern `body_html` noch NULL ist — folgendes tut:

- `contact-message`, `course-request`, `membership-application`, `new-registration`, `course-assignment`, `cancellation-internal`, `cancellation-confirmation`:  
  Passenden Quelldatensatz per `recipient_email` + Zeitfenster (`created_at ± wenige Minuten`) finden, `templateData` daraus zusammenbauen, mit dem existierenden React-Email-Template rendern und Betreff + HTML + Text in die Log-Zeile schreiben.
- `message-reply`, `course-request-reply`:  
  Der eigentlich getippte Antworttext ist verloren. Wir schreiben stattdessen einen deutlich gekennzeichneten Platzhalter („⚠️ Antworttext nicht mehr verfügbar – nur Kontext rekonstruiert“) plus die Originalanfrage aus `messages` / `course_requests`. So sieht man wenigstens, worum es ging.
- Auth-Templates (`signup`, `recovery`, …): bleiben ohne Inhalt (Tokens dürfen nicht rekonstruiert werden). Bekommen einen kurzen Hinweistext im `body_text`, damit der Detail-Dialog nicht leer wirkt.
- Falls kein Quelldatensatz gefunden wird, bleibt die Zeile unverändert.

Umsetzung:
- Neue Datei `src/lib/email-backfill.functions.ts` mit `backfillEmailBodies` (`requireSupabaseAuth`, Admin-Rollen-Check über `has_role`).
- Kleiner Button „Alte E-Mails rekonstruieren“ im Kopfbereich von `src/routes/_authenticated/admin/emails.tsx`, sichtbar für Admins; zeigt danach eine Toast-Zusammenfassung („X aktualisiert, Y ohne Quelle, Z übersprungen“).
- Der Endpunkt läuft in Batches (z. B. 200 pro Aufruf), damit lange Historien nicht in einen Request-Timeout laufen; Fortschritt wird über den Toast wiederholbar angezeigt („Weiter rekonstruieren“ falls noch Zeilen offen sind).

## Nicht im Scope
- Kein neues E-Mail-Schema jenseits der bereits vorhandenen Spalten (`subject`, `body_text`, `body_html`, `sender_user_id`).
- Keine Rekonstruktion von Auth-Mail-Inhalten mit echten Tokens.
- Kein Backfill des tatsächlichen freien Antworttexts früherer manueller Antworten (Daten existieren nicht mehr).
