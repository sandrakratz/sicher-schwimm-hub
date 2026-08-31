ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS signup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signup_note text;

CREATE TABLE public.event_shift_signups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available boolean NOT NULL DEFAULT true,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_shift_signups_event ON public.event_shift_signups(event_id);
CREATE INDEX idx_event_shift_signups_trainer ON public.event_shift_signups(trainer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_shift_signups TO authenticated;
GRANT ALL ON public.event_shift_signups TO service_role;

ALTER TABLE public.event_shift_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainer manage own signups"
  ON public.event_shift_signups FOR ALL TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "Trainers and staff can view signups"
  ON public.event_shift_signups FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'trainer'));

CREATE POLICY "Staff can update signups"
  ON public.event_shift_signups FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete signups"
  ON public.event_shift_signups FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER trg_event_shift_signups_updated
  BEFORE UPDATE ON public.event_shift_signups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();