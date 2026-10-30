-- Trainerbereich: Kalender-Abo, Bestätigung von Einteilungen, Wunschlast/Erinnerungen, Qualifikationen
-- und Cron für Erinnerungs-Mails (täglich 17:00 UTC = 18/19 Uhr Berliner Zeit).

-- 1) Persönlicher Kalender-Link (geheimer Token) -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trainer_calendar_tokens (
  trainer_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_calendar_tokens TO authenticated;
GRANT ALL ON public.trainer_calendar_tokens TO service_role;
ALTER TABLE public.trainer_calendar_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trainers manage own calendar token" ON public.trainer_calendar_tokens
  FOR ALL TO authenticated
  USING (
    trainer_id = auth.uid()
    AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'trainer'))
  )
  WITH CHECK (
    trainer_id = auth.uid()
    AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'trainer'))
  );

-- 2) Einteilung bestätigen --------------------------------------------------------------------
ALTER TABLE public.course_session_assignments
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- 3) Wunschlast und Erinnerungen ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trainer_settings (
  trainer_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  max_per_month smallint CHECK (max_per_month IS NULL OR max_per_month BETWEEN 1 AND 40),
  reminders boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_settings TO authenticated;
GRANT ALL ON public.trainer_settings TO service_role;
ALTER TABLE public.trainer_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read trainer settings" ON public.trainer_settings
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Trainers manage own settings" ON public.trainer_settings
  FOR ALL TO authenticated
  USING (
    trainer_id = auth.uid()
    AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'trainer'))
  )
  WITH CHECK (
    trainer_id = auth.uid()
    AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'trainer'))
  );
CREATE TRIGGER trg_trainer_settings_updated
  BEFORE UPDATE ON public.trainer_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Qualifikationen mit Ablaufdatum ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trainer_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('rettungsschwimmer', 'erste_hilfe', 'fuehrungszeugnis', 'trainerlizenz', 'sonstiges')),
  valid_until date,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trainer_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_qualifications TO authenticated;
GRANT ALL ON public.trainer_qualifications TO service_role;
ALTER TABLE public.trainer_qualifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read qualifications" ON public.trainer_qualifications
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Trainers manage own qualifications" ON public.trainer_qualifications
  FOR ALL TO authenticated
  USING (
    trainer_id = auth.uid()
    AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'trainer'))
  )
  WITH CHECK (
    trainer_id = auth.uid()
    AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'trainer'))
  );
CREATE TRIGGER trg_trainer_qualifications_updated
  BEFORE UPDATE ON public.trainer_qualifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Cron: Erinnerungen an Trainer:innen (wie bei den bestehenden Erinnerungen, anderer Endpunkt)
select cron.schedule(
  'trainer-reminders-daily',
  '0 17 * * *',
  replace(
    (select command from cron.job where jobname = 'course-start-reminder-daily'),
    '/hooks/course-start-reminder',
    '/hooks/trainer-reminders'
  )
);
