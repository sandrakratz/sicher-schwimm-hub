ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS member_email text,
  ADD COLUMN IF NOT EXISTS member_phone text,
  ADD COLUMN IF NOT EXISTS minor_consents jsonb,
  ADD COLUMN IF NOT EXISTS payer_role text;