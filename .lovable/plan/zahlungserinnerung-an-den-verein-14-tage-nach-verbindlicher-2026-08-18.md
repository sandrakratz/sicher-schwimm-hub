# Zahlungserinnerung an den Verein – 14 Tage nach verbindlicher Buchung

14 Tage nach einer verbindlichen Online-Buchung geht automatisch eine E-Mail an info@sicher-schwimmen.com mit der Bitte, den Geldeingang zu prüfen.

## Inhalt der E-Mail

- Betreff: „Geldeingang prüfen – <Kind> (Kursbeginn <Datum>)"
- Name des Kindes
- Kursangebot und Kurszeitraum inkl. Kursbeginn
- Buchungsdatum, Betrag, Dokument-Nr., Verwendungszweck
- Name und E-Mail der Eltern
- Hinweis, dass der Zahlungsstatus im Adminbereich auf „bezahlt" gesetzt werden kann

## Wann sie versendet wird

- Nur für verbindliche Buchungen (Status bestätigt), nicht für Wartelisten-Einträge
- Nur, wenn die Zahlung im Adminbereich noch nicht als bezahlt markiert ist
- Genau einmal pro Buchung (feste Idempotenz je Teilnehmer-Datensatz)
- Prüfung läuft täglich einmal automatisch

## Technische Umsetzung

- Neue Vorlage `src/lib/email-templates/payment-check-reminder.tsx` (Empfänger fest `info@sicher-schwimmen.com`), registriert in `src/lib/email-templates/registry.ts`. Datumsformate über `formatDateBerlin` aus `src/lib/format.ts`.
- Neue Cron-Route `src/routes/api/public/hooks/payment-check-reminder.ts` (POST, `apikey`-Header mit dem Anon-Key wird geprüft). Sie liest über `supabaseAdmin` aus `course_participants` alle Datensätze mit `online_booking = true`, `status = 'confirmed'`, `paid = false` und `created_at <= now() - 14 Tage`, lädt den zugehörigen Kurs samt Kursangebot und reiht je Datensatz eine E-Mail über `queueTemplateEmail` ein – mit `idempotencyKey = payment-check-<participant_id>`, sodass keine Wiederholungen entstehen.
- Täglicher `pg_cron`-Job (via SQL, kein Migrationsfile), der die Route einmal pro Tag um 08:00 Berliner Zeit aufruft.
