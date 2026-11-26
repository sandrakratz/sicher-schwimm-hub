-- Übungsleiter-Auszahlungen: Eine freigegebene Auszahlung lässt sich nur noch zu zweit stornieren
-- (Vorstand 26.11.2026): Person A beantragt die Stornierung mit Grund, eine zweite Person bestätigt.
-- Wer beantragt hat oder Empfänger:in ist, kann nicht bestätigen. Geschrieben wird nur über
-- Server-Funktionen (service_role).

ALTER TABLE public.trainer_payouts
  ADD COLUMN IF NOT EXISTS cancel_requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

COMMENT ON COLUMN public.trainer_payouts.cancel_requested_by IS
  'Beantragte Stornierung einer freigegebenen Auszahlung; eine zweite Person muss bestätigen';
COMMENT ON COLUMN public.trainer_payouts.cancel_reason IS
  'Grund der beantragten Stornierung (z. B. Fehlbuchung)';
