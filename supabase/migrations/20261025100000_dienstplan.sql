-- Dienstplan: Sperrzeiten der Trainer:innen, Protokoll aller Änderungen, Markierung „Ersatz gesucht“.

-- Vom Vorstand ausgelöste Ersatzanfrage: solange gesetzt und der Termin nicht voll ist, sehen die
-- Trainer:innen den Termin unter „Ersatz gesucht“.
ALTER TABLE public.course_sessions
  ADD COLUMN IF NOT EXISTS replacement_requested_at timestamptz;

-- Sperrzeiten: Zeitraum, optional nur bestimmte Wochentage (1 = Montag … 7 = Sonntag).
CREATE TABLE IF NOT EXISTS public.trainer_blackouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date_from date NOT NULL,
  date_to date NOT NULL,
  weekdays smallint[],
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (date_to >= date_from)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_blackouts TO authenticated;
GRANT ALL ON public.trainer_blackouts TO service_role;
ALTER TABLE public.trainer_blackouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read blackouts"
  ON public.trainer_blackouts FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Trainers manage own blackouts"
  ON public.trainer_blackouts FOR ALL TO authenticated
  USING (
    trainer_id = auth.uid()
    AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'trainer'))
  )
  WITH CHECK (
    trainer_id = auth.uid()
    AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'trainer'))
  );

CREATE INDEX IF NOT EXISTS idx_trainer_blackouts_trainer ON public.trainer_blackouts(trainer_id);

-- Protokoll: wer hat wann wen ein-/ausgeteilt oder abgesagt, und warum.
-- Namen und Terminbezeichnung stehen als Momentaufnahme dabei, damit der Eintrag auch nach Löschungen lesbar bleibt.
CREATE TABLE IF NOT EXISTS public.dienstplan_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL CHECK (
    action IN (
      'assigned',
      'unassigned',
      'withdrawn',
      'withdrawn_by_staff',
      'claimed',
      'replacement_requested'
    )
  ),
  session_id uuid REFERENCES public.course_sessions(id) ON DELETE SET NULL,
  trainer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_label text,
  session_date date,
  trainer_name text,
  actor_name text,
  reason text
);

-- Zugriff nur lesend für den Vorstand; geschrieben wird ausschließlich über die Server-Funktionen (Service-Rolle)
GRANT SELECT ON public.dienstplan_log TO authenticated;
GRANT ALL ON public.dienstplan_log TO service_role;
ALTER TABLE public.dienstplan_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read dienstplan log"
  ON public.dienstplan_log FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_dienstplan_log_created ON public.dienstplan_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dienstplan_log_session ON public.dienstplan_log(session_id);
