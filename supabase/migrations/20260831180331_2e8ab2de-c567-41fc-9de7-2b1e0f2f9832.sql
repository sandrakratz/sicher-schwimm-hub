-- Wer darf sich als Helfer:in eintragen: Team oder aktives Mitglied
CREATE OR REPLACE FUNCTION public.can_help(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_staff(_user_id)
      OR public.has_role(_user_id, 'trainer')
      OR public.has_active_membership(_user_id)
$$;

CREATE TABLE public.event_helper_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  needed_count integer NOT NULL DEFAULT 1,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  note text,
  filled_at timestamp with time zone,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_helper_groups_event ON public.event_helper_groups(event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_helper_groups TO authenticated;
GRANT ALL ON public.event_helper_groups TO service_role;

ALTER TABLE public.event_helper_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Helpers can view helper groups"
  ON public.event_helper_groups FOR SELECT TO authenticated
  USING (public.can_help(auth.uid()));

CREATE POLICY "Staff can manage helper groups"
  ON public.event_helper_groups FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER trg_event_helper_groups_updated
  BEFORE UPDATE ON public.event_helper_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Rückmeldungen können einer Helfergruppe zugeordnet werden
ALTER TABLE public.event_shift_signups
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.event_helper_groups(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS helper_name text;

CREATE INDEX idx_event_shift_signups_group ON public.event_shift_signups(group_id);

-- Sichtbarkeit auf Helfer:innen (Team + aktive Mitglieder) erweitern
DROP POLICY IF EXISTS "Trainers and staff can view signups" ON public.event_shift_signups;

CREATE POLICY "Helpers can view signups"
  ON public.event_shift_signups FOR SELECT TO authenticated
  USING (public.can_help(auth.uid()));