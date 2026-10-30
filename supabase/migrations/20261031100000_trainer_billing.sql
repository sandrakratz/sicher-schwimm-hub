-- Übungsleiter-Abrechnung: Stundensätze je Trainer:in und Kursart (mit „gültig ab“) sowie Auszahlungen.
-- Geschrieben wird ausschließlich über Server-Funktionen (Service-Role); Lesen: Vorstand/Admin, Auszahlungen
-- zusätzlich die Trainer:in selbst.

-- 1) Stundensätze ------------------------------------------------------------------------------
-- program_id = Kursart (course_programs); NULL = Satz für Kurse ohne Kursart bzw. Standardsatz.
CREATE TABLE IF NOT EXISTS public.trainer_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.course_programs(id) ON DELETE CASCADE,
  hourly_rate numeric(8,2) NOT NULL CHECK (hourly_rate >= 0 AND hourly_rate <= 500),
  valid_from date NOT NULL DEFAULT current_date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Pro Trainer:in, Kursart und Datum nur ein Satz (NULL-Kursart zählt als eigene Kursart)
CREATE UNIQUE INDEX IF NOT EXISTS trainer_rates_unique
  ON public.trainer_rates (
    trainer_id,
    COALESCE(program_id, '00000000-0000-0000-0000-000000000000'::uuid),
    valid_from
  );
CREATE INDEX IF NOT EXISTS idx_trainer_rates_trainer ON public.trainer_rates(trainer_id);

REVOKE ALL ON public.trainer_rates FROM anon, authenticated;
GRANT SELECT ON public.trainer_rates TO authenticated;
GRANT ALL ON public.trainer_rates TO service_role;
ALTER TABLE public.trainer_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read trainer rates" ON public.trainer_rates
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- 2) Auszahlungen --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trainer_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  paid_on date NOT NULL,
  total_amount numeric(10,2) NOT NULL CHECK (total_amount >= 0),
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trainer_payouts_trainer ON public.trainer_payouts(trainer_id, paid_on);

-- Einzelposten: Satz und Stunden werden zum Zeitpunkt der Auszahlung festgeschrieben.
-- Ein Termin kann je Trainer:in nur einmal ausgezahlt werden.
CREATE TABLE IF NOT EXISTS public.trainer_payout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id uuid NOT NULL REFERENCES public.trainer_payouts(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL REFERENCES public.course_sessions(id) ON DELETE RESTRICT,
  session_date date NOT NULL,
  course_name text NOT NULL,
  program_name text,
  hours_billed numeric(5,2) NOT NULL CHECK (hours_billed > 0),
  hourly_rate numeric(8,2) NOT NULL CHECK (hourly_rate >= 0),
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  UNIQUE (session_id, trainer_id)
);
CREATE INDEX IF NOT EXISTS idx_trainer_payout_items_payout ON public.trainer_payout_items(payout_id);

REVOKE ALL ON public.trainer_payouts FROM anon, authenticated;
REVOKE ALL ON public.trainer_payout_items FROM anon, authenticated;
GRANT SELECT ON public.trainer_payouts TO authenticated;
GRANT SELECT ON public.trainer_payout_items TO authenticated;
GRANT ALL ON public.trainer_payouts TO service_role;
GRANT ALL ON public.trainer_payout_items TO service_role;
ALTER TABLE public.trainer_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_payout_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or staff read payouts" ON public.trainer_payouts
  FOR SELECT TO authenticated
  USING (trainer_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Own or staff read payout items" ON public.trainer_payout_items
  FOR SELECT TO authenticated
  USING (trainer_id = auth.uid() OR public.is_staff(auth.uid()));

COMMENT ON TABLE public.trainer_rates IS
  'Stundensatz je Trainer:in und Kursart, gültig ab Datum; Pflege durch Vorstand/Admin über Server-Funktionen';
COMMENT ON TABLE public.trainer_payouts IS
  'Bestätigte Auszahlungen der Übungsleitergelder (Datum, Summe); Einzelposten in trainer_payout_items';
