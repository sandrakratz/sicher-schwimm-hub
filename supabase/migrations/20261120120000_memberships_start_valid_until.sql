-- Mitgliedschaft: Beginn („Mitglied ab“) und Ende der Gültigkeit.
-- start_date: vom Antragsteller gewählt (heute bis 6 Monate im Voraus); Beitrag und Mitgliedspreis gelten ab diesem Datum.
-- valid_until: wird von der Verwaltung nach gültiger Kündigung auf den 31.12. gesetzt (Satzung § 5: 6 Wochen zum Jahresende).
-- NULL = keine Einschränkung (bestehende Mitgliedschaften gelten unverändert).
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS valid_until date;
