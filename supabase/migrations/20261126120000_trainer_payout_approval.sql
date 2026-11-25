-- Übungsleiter-Abrechnung: Freigabe durch eine zweite Person, harte Grenze 3.300 €/Jahr mit Begründung
-- beim Überschreiten, und jährliche Erklärung der Trainer:innen (Vorstand 25.11.2026).
-- Geschrieben und gelesen wird nur über Server-Funktionen (service_role).

-- 1) Auszahlungen: Status und Freigabe. Bisherige Auszahlungen gelten als freigegeben.
ALTER TABLE public.trainer_payouts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS cap_override_reason text;

ALTER TABLE public.trainer_payouts DROP CONSTRAINT IF EXISTS trainer_payouts_status_check;
ALTER TABLE public.trainer_payouts
  ADD CONSTRAINT trainer_payouts_status_check CHECK (status IN ('pending', 'approved'));

COMMENT ON COLUMN public.trainer_payouts.status IS
  'pending = zur Freigabe angelegt; approved = von einer zweiten Person freigegeben';
COMMENT ON COLUMN public.trainer_payouts.cap_override_reason IS
  'Begründung, wenn die Auszahlung den Jahresfreibetrag überschreitet oder die Jahreserklärung fehlt';

-- 2) Jahreserklärung der Trainer:innen
CREATE TABLE IF NOT EXISTS public.trainer_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  side_job boolean NOT NULL,
  other_allowance numeric(10, 2) NOT NULL DEFAULT 0 CHECK (other_allowance >= 0),
  other_note text,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trainer_id, year)
);

REVOKE ALL ON public.trainer_declarations FROM anon, authenticated;
GRANT ALL ON public.trainer_declarations TO service_role;
ALTER TABLE public.trainer_declarations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.trainer_declarations IS
  'Jährliche Erklärung zur Übungsleiterpauschale: nebenberuflich ja/nein, Freibetrag bei anderen Auftraggebern bereits genutzt';
