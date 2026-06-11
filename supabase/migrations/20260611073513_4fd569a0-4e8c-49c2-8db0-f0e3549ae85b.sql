
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS price_member numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_non_member numeric(10,2),
  ADD COLUMN IF NOT EXISTS payment_due_days integer NOT NULL DEFAULT 14;

ALTER TABLE public.course_participants
  ADD COLUMN IF NOT EXISTS is_member boolean,
  ADD COLUMN IF NOT EXISTS member_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS member_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS member_confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS price_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS parent_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_course_participants_parent_user_id
  ON public.course_participants(parent_user_id);

-- Update RLS: Users see own enrollments OR enrollments of their children (parent_user_id)
DROP POLICY IF EXISTS "Users view own enrollments" ON public.course_participants;
CREATE POLICY "Users view own enrollments"
ON public.course_participants
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR auth.uid() = parent_user_id
  OR is_staff(auth.uid())
);

-- Extend handle_new_user to auto-link participants by email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name');

  -- Auto-link existing course participants with matching parent email
  UPDATE public.course_participants
  SET parent_user_id = NEW.id
  WHERE parent_user_id IS NULL
    AND participant_email IS NOT NULL
    AND lower(participant_email) = lower(NEW.email);

  RETURN NEW;
END;
$function$;
