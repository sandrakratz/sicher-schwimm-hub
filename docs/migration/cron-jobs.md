# Geplante Aufgaben (Datenbank-Cron)

Stand: 30.09.2026. Quelle: direkte Abfrage der Tabelle `cron.job`. Zeitpläne in UTC (06:00 UTC = 08:00 Berlin Sommerzeit).
Alle Aufgaben sind aktiv und rufen per `net.http_post` einen öffentlichen Endpunkt der App auf.

Hinweis: Der `apikey`-Header wurde bereits von der Datenbankschnittstelle geschwärzt und hier durch PLATZHALTER ersetzt (es handelt sich um den öffentlichen Publishable/Anon-Key des Projekts). Beim Umzug muss die URL `project--1e2b8058-...lovable.app` durch die neue Domain ersetzt werden.

| Name | Zeitplan (cron) | Bedeutung |
|---|---|---|
| course-start-reminder-daily | `0 6 * * *` | täglich 06:00 UTC |
| majority-notice-daily | `0 6 * * *` | täglich 06:00 UTC |
| partial-certificate-daily | `30 14 * * *` | täglich 14:30 UTC (16:30 Berlin) |
| payment-check-reminder-daily | `0 6 * * *` | täglich 06:00 UTC |
| waitlist-sweep-hourly | `0 * * * *` | stündlich |
| transfer-consent-reminder-daily | `0 6 * * *` | täglich 06:00 UTC – Erinnerung an Eltern, die einer Kursumbuchung nach 3 Tagen noch nicht zugestimmt haben (Migration `20261002120000_transfer_consent_reminder.sql`, Endpunkt `/api/public/hooks/transfer-consent-reminder`) |

## Vollständige Befehle

### course-start-reminder-daily
```sql
select net.http_post(
  url:='https://project--1e2b8058-d61e-414e-897d-1568fa6d56b3.lovable.app/api/public/hooks/course-start-reminder',
  headers:='{"Content-Type": "application/json", "apikey": "PLATZHALTER"}'::jsonb,
  body:='{}'::jsonb, timeout_milliseconds:=30000
) as request_id;
```

### majority-notice-daily
```sql
select net.http_post(
  url:='https://project--1e2b8058-d61e-414e-897d-1568fa6d56b3.lovable.app/api/public/hooks/majority-notice',
  headers:='{"Content-Type": "application/json", "apikey": "PLATZHALTER"}'::jsonb,
  body:='{}'::jsonb, timeout_milliseconds:=30000
) as request_id;
```

### partial-certificate-daily
```sql
select net.http_post(
  url:='https://project--1e2b8058-d61e-414e-897d-1568fa6d56b3.lovable.app/api/public/hooks/partial-certificate',
  headers:='{"Content-Type": "application/json", "apikey": "PLATZHALTER"}'::jsonb,
  body:='{}'::jsonb, timeout_milliseconds:=30000
) as request_id;
```

### payment-check-reminder-daily
```sql
select net.http_post(
  url:='https://project--1e2b8058-d61e-414e-897d-1568fa6d56b3.lovable.app/api/public/hooks/payment-check-reminder',
  headers:='{"Content-Type": "application/json", "apikey": "PLATZHALTER"}'::jsonb,
  body:='{}'::jsonb, timeout_milliseconds:=30000
) as request_id;
```

### waitlist-sweep-hourly
```sql
select net.http_post(
  url:='https://project--1e2b8058-d61e-414e-897d-1568fa6d56b3.lovable.app/api/public/hooks/waitlist-sweep',
  headers:='{"Content-Type": "application/json", "apikey": "PLATZHALTER"}'::jsonb,
  body:='{}'::jsonb, timeout_milliseconds:=30000
) as request_id;
```

Die zugehörigen Endpunkte liegen im Code unter `src/routes/api/public/hooks/`.
