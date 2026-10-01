# Löschkonzept (automatische Löschjobs)

Stand: 01.10.2026. Grundlage: Datenschutzerklärung, Ziffer 4. Die Funktion `public.run_retention_cleanup()` kommt mit der Migration
`20261001120000_retention_cleanup.sql` und läuft täglich um 02:30 UTC (04:30 Uhr Sommerzeit, 03:30 Uhr Winterzeit) über `pg_cron`.

## Regel

Frist = **3 Jahre nach Ablauf des Kalenderjahres**, in dem der Anlass endete (Verjährung nach §§ 195, 199 BGB).
Beispiel: Ein Widerruf vom 15.06.2022 wird ab dem 01.01.2026 gelöscht. Einer aus 2023 bleibt bis zum 31.12.2026.

| Was | Anlass | Aktion |
|---|---|---|
| Versandprotokoll `email_send_log` | Versandzeitpunkt | Zeile löschen |
| Widerrufe `cancellation_requests` (mit IP) | Eingang | Zeile löschen |
| Gesundheitsangaben `course_requests.health_info` | Kursende (sonst Eingang der Anfrage) | Feld leeren |
| Notizen `course_participants.notes` | Kursende | Feld leeren |
| Notizen `waitlist_entries.notes` | Eintragung | Feld leeren |

Bei Gesundheits- und Notizfeldern bleibt der Datensatz bestehen, weil Buchungs- und Zahlungsbelege 10 Jahre aufbewahrt werden müssen (§ 147 AO).
Jeder Lauf mit Treffern wird im Verwaltungsprotokoll (`audit_logs`, Aktion `retention_cleanup`) mit den Anzahlen vermerkt.

## Einspielen und Kontrolle

1. Migration im Supabase SQL-Editor ausführen (setzt `pg_cron` voraus, ist laut `neue-einrichtung.md` eingeschaltet).
2. **Probelauf, ändert nichts:** `select public.run_retention_cleanup(true);` zeigt, wie viele Zeilen betroffen wären.
3. Prüfen, dass der Zeitplan steht: `select jobname, schedule, active from cron.job where jobname = 'retention-cleanup-daily';`
4. Am Folgetag Ergebnis ansehen: `select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;`

Gelöscht wird endgültig. Wer frühere Daten noch braucht, sollte vor dem Einspielen eine Sicherung exportieren.

## Nicht automatisiert (jährlich von Hand prüfen)

- Übrige Mitglieds- und Kursdaten nach Austritt bzw. Kursjahr („bis zu 3 Jahre“): Mitgliedschaften und Teilnehmer enthalten Belegdaten mit 10 Jahren Frist, daher keine Massenlöschung.
- Sperrliste: Einträge nach spätestens 2 Jahren prüfen und löschen (siehe Seite „Sperrliste“ im Verwaltungsbereich).
- Verwaltungsprotokoll `audit_logs` (mit IP-Adressen): derzeit unbegrenzt, Empfehlung 12 Monate.
- Mitglieder- und Trainerkonten nach Kündigung.
