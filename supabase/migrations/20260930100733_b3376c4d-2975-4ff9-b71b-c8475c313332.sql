ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS decline_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS followup_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS followup_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_decline_reason text;