
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS sepa_account_holder text,
  ADD COLUMN IF NOT EXISTS sepa_iban text,
  ADD COLUMN IF NOT EXISTS sepa_bic text,
  ADD COLUMN IF NOT EXISTS sepa_bank_name text,
  ADD COLUMN IF NOT EXISTS sepa_mandate_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sepa_signature_place text,
  ADD COLUMN IF NOT EXISTS sepa_signature_date date;
