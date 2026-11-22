-- Täglich Logins gekündigter Mitglieder löschen (30 Tage nach „gültig bis“, Endpunkt member-account-cleanup).
-- Befehl (URL + Schlüssel) wie bei den anderen Aufgaben von einer bestehenden übernehmen.
select cron.schedule('member-account-cleanup-daily', '0 3 * * *', replace((select command from cron.job where jobname='course-start-reminder-daily'), '/hooks/course-start-reminder', '/hooks/member-account-cleanup'));
