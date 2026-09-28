CREATE OR REPLACE FUNCTION public.link_profile_participants()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(NEW.email,'') = '' THEN RETURN NEW; END IF;
  UPDATE public.course_participants
    SET parent_user_id = NEW.id
    WHERE parent_user_id IS NULL AND user_id IS NULL AND participant_email IS NOT NULL
      AND lower(participant_email) = lower(NEW.email);
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.link_profile_participants() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_link_profile_participants ON public.profiles;
CREATE TRIGGER trg_link_profile_participants AFTER INSERT OR UPDATE OF email ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.link_profile_participants();

UPDATE public.course_participants cp SET parent_user_id = p.id
FROM public.profiles p
WHERE cp.parent_user_id IS NULL AND cp.user_id IS NULL AND cp.participant_email IS NOT NULL
  AND lower(cp.participant_email) = lower(p.email);

SELECT cron.alter_job(jobid, command := replace(command, 'body:=''{}''::jsonb', 'body:=''{}''::jsonb, timeout_milliseconds:=30000'))
FROM cron.job
WHERE command LIKE '%/api/public/hooks/%' AND command NOT LIKE '%timeout_milliseconds%';