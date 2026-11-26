-- Übungsleiter-Abrechnung: Auszahlungskonto bei der Freigabe festhalten, damit der Abrechnungsbeleg auch
-- später das Konto zeigt, auf das ausgezahlt wurde – selbst wenn die Trainer:in ihre Bankverbindung danach
-- ändert. Geschrieben wird nur über Server-Funktionen (service_role).

ALTER TABLE public.trainer_payouts
  ADD COLUMN IF NOT EXISTS payout_iban text,
  ADD COLUMN IF NOT EXISTS payout_account_holder text;

COMMENT ON COLUMN public.trainer_payouts.payout_iban IS
  'IBAN aus trainer_payout_details zum Zeitpunkt der Freigabe (leer = damals keine hinterlegt bzw. nicht bekannt)';
COMMENT ON COLUMN public.trainer_payouts.payout_account_holder IS
  'Kontoinhaber:in aus trainer_payout_details zum Zeitpunkt der Freigabe';

-- Bereits freigegebene Auszahlungen nachtragen, aber nur, wenn die hinterlegte Bankverbindung seit der
-- Freigabe (ältere Auszahlungen ohne Freigabezeitpunkt: seit dem Auszahlungstag) nicht geändert wurde.
-- Dann war sie damals dieselbe. Alle anderen bleiben leer; der Beleg zeigt dafür einen Hinweis.
UPDATE public.trainer_payouts p
SET payout_iban = d.iban,
    payout_account_holder = d.account_holder
FROM public.trainer_payout_details d
WHERE d.user_id = p.trainer_id
  AND p.status = 'approved'
  AND p.payout_iban IS NULL
  AND d.updated_at < COALESCE(p.approved_at, (p.paid_on + 1)::timestamptz);
