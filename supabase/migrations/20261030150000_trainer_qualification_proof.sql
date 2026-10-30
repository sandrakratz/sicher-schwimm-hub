-- Qualifikationen: Ausstellungsdatum (Ablauf ergibt sich z. B. aus „alle 2 Jahre“) und
-- „Nachweis geprüft“ durch den Vorstand. Die Prüfung steht bewusst in einer eigenen Tabelle, die nur der Server
-- (Vorstand) beschreibt – so kann niemand seinen eigenen Nachweis als geprüft markieren.

ALTER TABLE public.trainer_qualifications
  ADD COLUMN IF NOT EXISTS issued_on date;

CREATE TABLE IF NOT EXISTS public.trainer_qualification_checks (
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  -- Stand des Nachweises zum Zeitpunkt der Prüfung („ausgestellt|gültig bis“); ändert die Person ihn, gilt er als ungeprüft
  stamp text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  checked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (trainer_id, kind)
);

GRANT SELECT ON public.trainer_qualification_checks TO authenticated;
GRANT ALL ON public.trainer_qualification_checks TO service_role;
ALTER TABLE public.trainer_qualification_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read qualification checks" ON public.trainer_qualification_checks
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Trainers read own qualification checks" ON public.trainer_qualification_checks
  FOR SELECT TO authenticated USING (trainer_id = auth.uid());
