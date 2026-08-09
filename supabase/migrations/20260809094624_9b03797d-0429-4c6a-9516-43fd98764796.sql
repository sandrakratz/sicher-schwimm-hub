ALTER TABLE public.course_participants
  ADD COLUMN IF NOT EXISTS payer_street text,
  ADD COLUMN IF NOT EXISTS payer_zip text,
  ADD COLUMN IF NOT EXISTS payer_city text,
  ADD COLUMN IF NOT EXISTS document_no text,
  ADD COLUMN IF NOT EXISTS document_issued_at timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS course_participants_document_no_key
  ON public.course_participants (document_no) WHERE document_no IS NOT NULL;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS unit_count integer;

CREATE SEQUENCE IF NOT EXISTS public.course_document_no_seq;

CREATE OR REPLACE FUNCTION public.generate_course_document_no()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'SK-' || to_char(now() AT TIME ZONE 'Europe/Berlin', 'YYYY') || '-' ||
         lpad(nextval('public.course_document_no_seq')::text, 5, '0');
$$;

REVOKE ALL ON FUNCTION public.generate_course_document_no() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_course_document_no() TO service_role;