-- „Termin fällt aus“ (Vorstand 26.11.2026): Ein ausgefallener Kurstermin wird aus dem Terminplan
-- genommen (dann verschwindet er überall: Dienstplan, Anwesenheit, Portal, Trainer-Kalender) und hier
-- protokolliert – mit Grund, wer, wann und wer benachrichtigt wurde. Nur möglich, solange zum Termin
-- keine Anwesenheit erfasst ist (sonst Versicherungs-/Abrechnungsnachweis).
-- Geschrieben wird nur über die Server-Funktion (service_role); lesen darf der Vorstand.
-- Nur eine neue Tabelle, löscht nichts.

CREATE TABLE IF NOT EXISTS public.course_session_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  session_index integer,
  session_date date NOT NULL,
  start_time time,
  end_time time,
  reason text NOT NULL,
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_at timestamptz NOT NULL DEFAULT now(),
  parents_notified integer NOT NULL DEFAULT 0,
  trainers_notified integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS course_session_cancellations_course_idx
  ON public.course_session_cancellations (course_id, session_date);

REVOKE ALL ON public.course_session_cancellations FROM anon, authenticated;
GRANT SELECT ON public.course_session_cancellations TO authenticated;
GRANT ALL ON public.course_session_cancellations TO service_role;
ALTER TABLE public.course_session_cancellations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view session cancellations" ON public.course_session_cancellations;
CREATE POLICY "Staff can view session cancellations" ON public.course_session_cancellations
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

COMMENT ON TABLE public.course_session_cancellations IS
  'Protokoll ausgefallener Kurstermine („Termin fällt aus“): Datum, Grund, wer, wann, Benachrichtigungen';
