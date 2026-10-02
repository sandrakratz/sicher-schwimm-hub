-- Einmalige Erinnerung, wenn die Eltern der Umbuchung nach 3 Tagen noch nicht zugestimmt haben.
ALTER TABLE public.course_transfer_consents ADD COLUMN IF NOT EXISTS reminded_at timestamptz;

-- Täglicher Aufruf wie bei den anderen Aufgaben: Befehl (URL + Schlüssel) von einer bestehenden Aufgabe übernehmen.
select cron.schedule('transfer-consent-reminder-daily', '0 6 * * *', replace((select command from cron.job where jobname='course-start-reminder-daily'), '/hooks/course-start-reminder', '/hooks/transfer-consent-reminder'));
