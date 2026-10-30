-- Grundsätzliche Bereitschaft der Trainer:innen je Kursart (z. B. „keine Erwachsenenkurse“).
-- Keine Zeile = „geht auch“. Gespeichert werden nur Abweichungen: 'gern' oder 'nein'.
-- Der Dienstplan schlägt bei 'nein' niemanden vor und bevorzugt bei 'gern'.

CREATE TABLE IF NOT EXISTS public.trainer_program_preferences (
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.course_programs(id) ON DELETE CASCADE,
  preference text NOT NULL CHECK (preference IN ('gern', 'nein')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trainer_id, program_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_program_preferences TO authenticated;
GRANT ALL ON public.trainer_program_preferences TO service_role;
ALTER TABLE public.trainer_program_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read program preferences" ON public.trainer_program_preferences
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Trainers manage own program preferences" ON public.trainer_program_preferences
  FOR ALL TO authenticated
  USING (
    trainer_id = auth.uid()
    AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'trainer'))
  )
  WITH CHECK (
    trainer_id = auth.uid()
    AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'trainer'))
  );

CREATE TRIGGER trg_trainer_program_preferences_updated
  BEFORE UPDATE ON public.trainer_program_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
