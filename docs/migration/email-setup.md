# E-Mail-Versand

> **Archiv – Zustand vor dem Umzug.** Diese Datei beschreibt die Lage auf Lovable Cloud (Stand 30.09.2026). Der Umzug auf Cloudflare + Supabase + Resend ist seit 01.10.2026 abgeschlossen (siehe `neue-einrichtung.md`); Aussagen zu Lovable gelten nur für den alten Zustand. Heute läuft der Versand über Resend (`src/lib/email-send.server.ts`), die Anmelde-Mails über `src/routes/email/auth-hook.ts`; die hier genannten Dateien unter `src/routes/lovable/` gibt es nicht mehr.

Stand: 30.09.2026.

## Aufbau
- **Anbieter:** Lovable Emails (Lovable-E-Mail-Schnittstelle, authentifiziert mit `LOVABLE_API_KEY`).
- **Absender:** `Sicher Schwimmen <noreply@notify.sicher-schwimmen.com>`
- **Absenderdomain:** `notify.sicher-schwimmen.com` (Subdomain der Hauptdomain `sicher-schwimmen.com`; DNS-Einträge für Versand liegen bei dieser Subdomain).
- **App-Mails (transaktional):** `src/lib/email-send.server.ts`, Vorlagen in `src/lib/email-templates/` (React-Email, Registry `registry.ts`). Jede Mail wird in der Tabelle `email_send_log` protokolliert (aktuell 551 Einträge); Doppelversand wird über einen Idempotenz-Schlüssel verhindert.
- **Anmelde-Mails:** über den Auth-E-Mail-Hook `src/routes/lovable/email/auth/webhook.ts`.
- **Zustellstatus/Abmeldungen:** `src/routes/lovable/email/events.ts`, Abmeldeseite `/unsubscribe` bzw. `src/routes/email/unsubscribe.ts`.

## Warteschlange im Hintergrund
In der Datenbank existieren die Funktionen `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq` (basierend auf der Erweiterung pgmq) aus einer früheren Einrichtung. **Aktuell läuft jedoch keine Warteschlange:** Es sind keine pgmq-Queues angelegt und kein Cron-Job verarbeitet eine Mail-Warteschlange. Mails werden direkt beim Auslösen synchron versendet. Zeitgesteuerte Mails (Erinnerungen, Wartelisten, Volljährigkeit, Teilprüfungsnachweise) werden über die Cron-Jobs (siehe `cron-jobs.md`) angestoßen.

## Beim Umzug
Lovable Emails ist nicht übertragbar. Einen eigenen Anbieter (z. B. SMTP/Resend/Postmark) für `notify.sicher-schwimmen.com` einrichten, DNS (SPF/DKIM/DMARC) neu setzen und `email-send.server.ts` sowie den Auth-Hook darauf umstellen.
