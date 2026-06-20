
CREATE TYPE public.cancellation_status AS ENUM ('eingegangen', 'in_bearbeitung', 'abgeschlossen');

CREATE TABLE public.cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL UNIQUE,
  parent_first_name TEXT NOT NULL,
  parent_last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  child_name TEXT NOT NULL,
  course_name TEXT NOT NULL,
  booking_date DATE NOT NULL,
  notes TEXT,
  revocation_text TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  status public.cancellation_status NOT NULL DEFAULT 'eingegangen',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.cancellation_requests TO authenticated;
GRANT ALL ON public.cancellation_requests TO service_role;

ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view cancellation requests"
  ON public.cancellation_requests FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update cancellation requests"
  ON public.cancellation_requests FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER cancellation_requests_set_updated_at
  BEFORE UPDATE ON public.cancellation_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX cancellation_requests_status_idx ON public.cancellation_requests (status);
CREATE INDEX cancellation_requests_created_at_idx ON public.cancellation_requests (created_at DESC);
CREATE INDEX cancellation_requests_ip_recent_idx ON public.cancellation_requests (ip_address, created_at DESC);
