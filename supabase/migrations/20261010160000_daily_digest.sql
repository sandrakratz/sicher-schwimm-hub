-- Tägliche Zusammenfassung „Das liegt heute bei dir“: Abbestellen je Vorstandsmitglied + Cron (werktags 06:00 UTC)
CREATE TABLE IF NOT EXISTS public.digest_optout (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Zugriff nur über Server-Funktionen (Service-Rolle)
ALTER TABLE public.digest_optout ENABLE ROW LEVEL SECURITY;

-- Cron-Aufruf wie bei den bestehenden Erinnerungen (gleicher Befehl, anderer Endpunkt)
select cron.schedule(
  'daily-digest',
  '0 6 * * 1-5',
  replace(
    (select command from cron.job where jobname = 'course-start-reminder-daily'),
    '/hooks/course-start-reminder',
    '/hooks/daily-digest'
  )
);
