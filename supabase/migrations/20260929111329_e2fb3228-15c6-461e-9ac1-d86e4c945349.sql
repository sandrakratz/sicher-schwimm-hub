CREATE TABLE public.majority_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  membership_id uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  child_index int,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date,
  email text,
  status text NOT NULL DEFAULT 'open',
  confirmed_data jsonb,
  wants_termination boolean NOT NULL DEFAULT false,
  user_id uuid,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (membership_id, child_index)
);
GRANT SELECT ON public.majority_confirmations TO authenticated;
GRANT ALL ON public.majority_confirmations TO service_role;
ALTER TABLE public.majority_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read majority confirmations" ON public.majority_confirmations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'board'));