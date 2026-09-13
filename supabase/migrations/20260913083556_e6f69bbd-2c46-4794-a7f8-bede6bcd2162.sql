CREATE OR REPLACE FUNCTION public.prevent_profile_status_selfchange()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND coalesce(auth.role(), '') <> 'service_role'
     AND NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only staff may change account status';
  END IF;
  RETURN NEW;
END;
$$;