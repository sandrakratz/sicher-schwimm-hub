
-- Backfill existing rows
UPDATE public.course_participants cp
SET parent_user_id = p.id
FROM public.profiles p
WHERE cp.parent_user_id IS NULL
  AND cp.participant_email IS NOT NULL
  AND lower(p.email) = lower(cp.participant_email);

-- Trigger function to auto-link on insert/update
CREATE OR REPLACE FUNCTION public.link_course_participant_to_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_user_id IS NULL AND NEW.participant_email IS NOT NULL THEN
    SELECT id INTO NEW.parent_user_id
    FROM public.profiles
    WHERE lower(email) = lower(NEW.participant_email)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_course_participant_to_parent ON public.course_participants;
CREATE TRIGGER trg_link_course_participant_to_parent
BEFORE INSERT OR UPDATE OF participant_email, parent_user_id
ON public.course_participants
FOR EACH ROW
EXECUTE FUNCTION public.link_course_participant_to_parent();
