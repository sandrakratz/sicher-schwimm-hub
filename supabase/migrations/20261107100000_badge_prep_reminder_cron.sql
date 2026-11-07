-- Erinnerung an Trainer:innen zwei Tage vor der letzten Kursstunde (Abzeichen und Siggi-Pässe vorbereiten).
-- Läuft täglich um 17:00 UTC = 18:00 Uhr im Winter (19:00 im Sommer). Gleiches Muster wie die anderen Erinnerungen.
select cron.schedule(
  'badge-prep-reminder-daily',
  '0 17 * * *',
  replace(
    (select command from cron.job where jobname = 'course-start-reminder-daily'),
    '/hooks/course-start-reminder',
    '/hooks/badge-prep-reminder'
  )
);
