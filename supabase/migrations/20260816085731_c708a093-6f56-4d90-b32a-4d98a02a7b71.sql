CREATE TABLE public.booking_blocklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_name_norm text,
  child_dob date,
  email_norm text,
  reason text,
  source text NOT NULL DEFAULT 'manual',
  request_id uuid REFERENCES public.course_requests(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_blocklist_source_chk CHECK (source IN ('manual','auto_rejected')),
  CONSTRAINT booking_blocklist_target_chk CHECK (email_norm IS NOT NULL OR (child_name_norm IS NOT NULL AND child_dob IS NOT NULL))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_blocklist TO authenticated;
GRANT ALL ON public.booking_blocklist TO service_role;

ALTER TABLE public.booking_blocklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view blocklist" ON public.booking_blocklist
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can insert blocklist" ON public.booking_blocklist
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can update blocklist" ON public.booking_blocklist
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can delete blocklist" ON public.booking_blocklist
  FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE TRIGGER trg_booking_blocklist_updated
  BEFORE UPDATE ON public.booking_blocklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX booking_blocklist_request_uidx ON public.booking_blocklist(request_id);
CREATE INDEX booking_blocklist_email_idx ON public.booking_blocklist(email_norm) WHERE active;
CREATE INDEX booking_blocklist_child_idx ON public.booking_blocklist(child_name_norm, child_dob) WHERE active;

CREATE OR REPLACE FUNCTION public.sync_blocklist_from_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'rejected' THEN
    INSERT INTO public.booking_blocklist (child_name_norm, child_dob, email_norm, reason, source, request_id, active)
    VALUES (
      NULLIF(lower(regexp_replace(coalesce(NEW.child_name,''), '\s+', ' ', 'g')), ''),
      NEW.child_dob,
      NULLIF(lower(trim(coalesce(NEW.parent_email,''))), ''),
      'Kursanfrage abgelehnt',
      'auto_rejected',
      NEW.id,
      true
    )
    ON CONFLICT (request_id) DO UPDATE
      SET active = true,
          child_name_norm = EXCLUDED.child_name_norm,
          child_dob = EXCLUDED.child_dob,
          email_norm = EXCLUDED.email_norm,
          updated_at = now();
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'rejected' AND NEW.status <> 'rejected' THEN
    UPDATE public.booking_blocklist
      SET active = false, updated_at = now()
      WHERE request_id = NEW.id AND source = 'auto_rejected';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_blocklist_from_request
  AFTER INSERT OR UPDATE OF status ON public.course_requests
  FOR EACH ROW EXECUTE FUNCTION public.sync_blocklist_from_request();

INSERT INTO public.booking_blocklist (child_name_norm, child_dob, email_norm, reason, source, request_id, active)
SELECT
  NULLIF(lower(regexp_replace(coalesce(r.child_name,''), '\s+', ' ', 'g')), ''),
  r.child_dob,
  NULLIF(lower(trim(coalesce(r.parent_email,''))), ''),
  'Kursanfrage abgelehnt',
  'auto_rejected',
  r.id,
  true
FROM public.course_requests r
WHERE r.status = 'rejected'
ON CONFLICT (request_id) DO NOTHING;