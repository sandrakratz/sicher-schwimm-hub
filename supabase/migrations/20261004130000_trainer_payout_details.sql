-- Bankverbindung für die Abrechnung der Übungsleitergelder.
-- Bewusst eine eigene Tabelle und nicht `profiles`: Trainer:innen dürfen einzelne fremde Profile lesen
-- (aktive Mitglieder); die IBAN darf nur die Person selbst und der Vorstand sehen.
-- Geschrieben wird ausschließlich über die Server-Funktion `saveMyPayoutDetails` (Service-Role), damit die
-- Hinweis-Mail an den Vorstand bei einer Änderung nicht umgangen werden kann.
CREATE TABLE IF NOT EXISTS public.trainer_payout_details (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  iban text NOT NULL CHECK (iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
  account_holder text NOT NULL CHECK (char_length(btrim(account_holder)) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trainer_payout_details ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.trainer_payout_details FROM anon, authenticated;
GRANT SELECT ON public.trainer_payout_details TO authenticated;
GRANT ALL ON public.trainer_payout_details TO service_role;

CREATE POLICY "Own payout details readable" ON public.trainer_payout_details
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE TRIGGER trg_trainer_payout_details_updated
  BEFORE UPDATE ON public.trainer_payout_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.trainer_payout_details IS
  'IBAN und Kontoinhaber:in für Übungsleitergelder; Pflege durch die Trainer:innen selbst, Einsicht für Vorstand/Admin';
