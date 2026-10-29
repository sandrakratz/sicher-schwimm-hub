-- Einsatzmöglichkeit der Trainer:innen je Nutzungstermin eines Bades, abgefragt im Voraus
-- (bevor es Kurse gibt). Grundlage für die Trainerprüfung in der Kursplanung.
-- Keine Antwort = offen; Sperrzeiten (trainer_blackouts) zählen automatisch als „kann nicht“.

CREATE TABLE IF NOT EXISTS public.pool_slot_availability (
  pool text NOT NULL CHECK (pool IN ('sportschule', 'kurbad')),
  slot_date date NOT NULL,
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pool, slot_date, trainer_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pool_slot_availability TO authenticated;
GRANT ALL ON public.pool_slot_availability TO service_role;
ALTER TABLE public.pool_slot_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read slot availability" ON public.pool_slot_availability
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Trainers manage own slot availability" ON public.pool_slot_availability
  FOR ALL TO authenticated
  USING (
    trainer_id = auth.uid()
    AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'trainer'))
  )
  WITH CHECK (
    trainer_id = auth.uid()
    AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'trainer'))
  );

CREATE TRIGGER trg_pool_slot_availability_updated
  BEFORE UPDATE ON public.pool_slot_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
