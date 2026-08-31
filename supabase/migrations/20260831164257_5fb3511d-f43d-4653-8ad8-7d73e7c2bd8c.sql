CREATE TABLE public.waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid REFERENCES public.course_programs(id) ON DELETE SET NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  child_name text,
  child_dob date,
  parent_name text NOT NULL,
  parent_email text NOT NULL,
  parent_phone text,
  parent_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_member boolean,
  notes text,
  admin_notes text,
  gdpr_consent boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'waiting',
  offer_course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  offer_token text UNIQUE,
  offered_at timestamp with time zone,
  offer_expires_at timestamp with time zone,
  responded_at timestamp with time zone,
  request_id uuid REFERENCES public.course_requests(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_entries_status_check CHECK (status IN ('waiting','offered','accepted','declined','expired','removed'))
);

CREATE INDEX idx_waitlist_entries_program ON public.waitlist_entries(program_id);
CREATE INDEX idx_waitlist_entries_course ON public.waitlist_entries(course_id);
CREATE INDEX idx_waitlist_entries_status ON public.waitlist_entries(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist_entries TO authenticated;
GRANT INSERT ON public.waitlist_entries TO anon;
GRANT ALL ON public.waitlist_entries TO service_role;

ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage waitlist"
  ON public.waitlist_entries FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Parents can view own waitlist entries"
  ON public.waitlist_entries FOR SELECT
  TO authenticated
  USING (parent_user_id = auth.uid());

CREATE POLICY "Anyone can join the waitlist"
  ON public.waitlist_entries FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'waiting'
    AND offer_token IS NULL
    AND offer_course_id IS NULL
    AND gdpr_consent = true
  );

CREATE TRIGGER trg_waitlist_entries_updated
  BEFORE UPDATE ON public.waitlist_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.course_programs
  ADD COLUMN IF NOT EXISTS waitlist_offer_days integer NOT NULL DEFAULT 3;

INSERT INTO public.waitlist_entries (
  program_id, course_id, child_name, child_dob, parent_name, parent_email, parent_phone,
  notes, admin_notes, gdpr_consent, status, request_id, created_at
)
SELECT
  c.program_id,
  NULL,
  r.child_name,
  r.child_dob,
  r.parent_name,
  r.parent_email,
  r.parent_phone,
  r.health_info,
  r.admin_notes,
  true,
  'waiting',
  r.id,
  r.created_at
FROM public.course_requests r
LEFT JOIN public.courses c ON c.id = r.assigned_course_id
WHERE r.status = 'waiting_list'
  AND r.assigned_course_id IS NULL;