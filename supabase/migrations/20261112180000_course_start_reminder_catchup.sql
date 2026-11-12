-- Nachlauf für die Erinnerung „3 Tage vor Kursstart“.
-- Der Aufruf um 06:00 UTC schafft pro Lauf nur ca. 18 Mails (Abfragegrenze bei Cloudflare). Was nicht mehr hineinpasst
-- oder wegen Tageslimit/Ausfall beim Mail-Anbieter fehlschlägt, holt dieser stündliche Nachlauf (07:05–18:05 UTC) nach.
-- Gleicher Aufruf wie der Hauptlauf; bereits versandte Mails werden über das Sendeprotokoll übersprungen. Ohne offene Mails kostet ein Lauf nur wenige Abfragen.
select cron.schedule(
  'course-start-reminder-catchup',
  '5 7-18 * * *',
  (select command from cron.job where jobname = 'course-start-reminder-daily')
);
