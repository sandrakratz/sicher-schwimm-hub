-- Abzeichen-Abnahme ohne Kursbuchung (z. B. Kinder anderer Schwimmschulen).
-- Bewusst eigene Tabelle und nicht course_participants: externe Kinder sollen keine Kursplätze
-- belegen und nicht in Zahlungen, Folgekursen oder Kurslisten auftauchen. Sie erscheinen nur im
-- Prüfungsprotokoll: entweder beim Kurs des Tages (course_id) oder als eigener Abnahmetermin
-- (course_id leer, dann zählen exam_date + location). Geschrieben und gelesen wird nur über
-- Server-Funktionen (Service-Role), daher keine Policy für Clients.
CREATE TABLE IF NOT EXISTS public.external_badge_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_date date NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  location text,
  person_name text NOT NULL,
  date_of_birth date NOT NULL,
  origin text,
  exam_level text,
  exam_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  exam_pass_no text,
  goal_reached boolean,
  badge text,
  achievement text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_external_badge_exams_date ON public.external_badge_exams(exam_date);
CREATE INDEX IF NOT EXISTS idx_external_badge_exams_course ON public.external_badge_exams(course_id);

REVOKE ALL ON public.external_badge_exams FROM anon, authenticated;
GRANT ALL ON public.external_badge_exams TO service_role;
ALTER TABLE public.external_badge_exams ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.external_badge_exams IS
  'Abzeichen-Abnahmen für Kinder ohne Kursbuchung (z. B. andere Schwimmschulen); nur für das Prüfungsprotokoll';
