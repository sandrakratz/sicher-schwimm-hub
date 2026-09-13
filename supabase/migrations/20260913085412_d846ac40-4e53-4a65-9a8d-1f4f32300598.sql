ALTER TABLE public.course_requests
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL;

ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_course_requests_profile ON public.course_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_course_requests_membership ON public.course_requests(membership_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_profile ON public.waitlist_entries(profile_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_membership ON public.waitlist_entries(membership_id);

-- Verknüpfung beim Anlegen/Ändern automatisch setzen
CREATE OR REPLACE FUNCTION public.link_identity_by_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _email text := lower(trim(coalesce(NEW.parent_email, '')));
BEGIN
  IF _email = '' THEN RETURN NEW; END IF;

  IF NEW.profile_id IS NULL THEN
    SELECT id INTO NEW.profile_id FROM public.profiles WHERE lower(email) = _email LIMIT 1;
  END IF;

  IF NEW.membership_id IS NULL THEN
    SELECT id INTO NEW.membership_id
    FROM public.memberships
    WHERE lower(email) = _email
    ORDER BY (status = 'active') DESC, created_at DESC
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_identity_course_requests ON public.course_requests;
CREATE TRIGGER trg_link_identity_course_requests
  BEFORE INSERT OR UPDATE OF parent_email ON public.course_requests
  FOR EACH ROW EXECUTE FUNCTION public.link_identity_by_email();

DROP TRIGGER IF EXISTS trg_link_identity_waitlist_entries ON public.waitlist_entries;
CREATE TRIGGER trg_link_identity_waitlist_entries
  BEFORE INSERT OR UPDATE OF parent_email ON public.waitlist_entries
  FOR EACH ROW EXECUTE FUNCTION public.link_identity_by_email();

-- Neue/geänderte Mitgliedschaften rückwirkend verknüpfen
CREATE OR REPLACE FUNCTION public.link_membership_to_entries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _email text := lower(trim(coalesce(NEW.email, '')));
BEGIN
  IF _email = '' THEN RETURN NEW; END IF;

  UPDATE public.course_requests
    SET membership_id = NEW.id
    WHERE membership_id IS NULL AND lower(trim(coalesce(parent_email, ''))) = _email;

  UPDATE public.waitlist_entries
    SET membership_id = NEW.id
    WHERE membership_id IS NULL AND lower(trim(coalesce(parent_email, ''))) = _email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_membership_to_entries ON public.memberships;
CREATE TRIGGER trg_link_membership_to_entries
  AFTER INSERT OR UPDATE OF email, status ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.link_membership_to_entries();

-- Einmaliger Abgleich der bestehenden Daten
UPDATE public.course_requests cr
  SET profile_id = p.id
  FROM public.profiles p
  WHERE cr.profile_id IS NULL AND lower(trim(coalesce(cr.parent_email,''))) = lower(p.email);

UPDATE public.waitlist_entries we
  SET profile_id = p.id
  FROM public.profiles p
  WHERE we.profile_id IS NULL AND lower(trim(coalesce(we.parent_email,''))) = lower(p.email);

UPDATE public.course_requests cr
  SET membership_id = m.id
  FROM public.memberships m
  WHERE cr.membership_id IS NULL AND lower(trim(coalesce(cr.parent_email,''))) = lower(trim(m.email));

UPDATE public.waitlist_entries we
  SET membership_id = m.id
  FROM public.memberships m
  WHERE we.membership_id IS NULL AND lower(trim(coalesce(we.parent_email,''))) = lower(trim(m.email));