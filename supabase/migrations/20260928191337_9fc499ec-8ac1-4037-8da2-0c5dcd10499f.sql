CREATE OR REPLACE FUNCTION public.link_course_participant_to_parent()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.parent_user_id IS NULL AND NEW.participant_email IS NOT NULL THEN
    SELECT id INTO NEW.parent_user_id FROM public.profiles
    WHERE lower(email) = lower(NEW.participant_email) LIMIT 1;
    IF NEW.parent_user_id IS NULL THEN
      SELECT user_id INTO NEW.parent_user_id FROM public.memberships
      WHERE user_id IS NOT NULL
        AND (lower(email) = lower(NEW.participant_email) OR lower(coalesce(guardian_email,'')) = lower(NEW.participant_email))
      ORDER BY (status = 'active') DESC LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_membership_participants()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.course_participants
    SET parent_user_id = NEW.user_id
    WHERE parent_user_id IS NULL AND user_id IS NULL AND participant_email IS NOT NULL
      AND (lower(participant_email) = lower(NEW.email)
           OR lower(participant_email) = lower(coalesce(NEW.guardian_email,'')));
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_link_membership_participants ON public.memberships;
CREATE TRIGGER trg_link_membership_participants AFTER INSERT OR UPDATE OF user_id, email, guardian_email ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.link_membership_participants();