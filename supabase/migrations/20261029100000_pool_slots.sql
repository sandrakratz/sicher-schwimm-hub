-- Nutzungstermine der Bäder (Sportschule: samstags, Kurbad: sonntags), z. B. Anlage 1 des Nutzungsvertrags.
-- Ein neuer Plan der Sportschule wird hochgeladen und überschreibt die Termine je Datum;
-- die Planung für Kurszeiträume liest von hier.

CREATE TABLE IF NOT EXISTS public.pool_slots (
  pool text NOT NULL DEFAULT 'sportschule' CHECK (pool IN ('sportschule', 'kurbad')),
  slot_date date NOT NULL,
  start_time time,
  end_time time,
  closed boolean NOT NULL DEFAULT false,
  pdf_note text,
  -- Eigene Festlegung: NULL = Standard (Feiertag entfällt), 'open' = Kurs findet statt,
  -- 'familie' = Familienschwimmen, 'entfaellt' = Termin entfällt.
  mode text CHECK (mode IN ('open', 'familie', 'entfaellt')),
  source_file text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pool, slot_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pool_slots TO authenticated;
GRANT ALL ON public.pool_slots TO service_role;

ALTER TABLE public.pool_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage pool slots" ON public.pool_slots
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER trg_pool_slots_updated
  BEFORE UPDATE ON public.pool_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trainer:innen sehen die Nutzungstermine, um ihre Einsatzmöglichkeiten dafür anzugeben.
CREATE POLICY "Trainers read pool slots" ON public.pool_slots
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'trainer'));
