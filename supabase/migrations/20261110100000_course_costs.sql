-- Kursergebnis: Kosten je Kurs (z. B. Wasserzeit/Hallenmiete), die der Vorstand von Hand einträgt.
-- Einnahmen (course_participants) und Übungsleitergelder (trainer_payout_items) werden aus den
-- vorhandenen Tabellen berechnet. Geschrieben wird nur über Server-Funktionen (Service-Role).
CREATE TABLE IF NOT EXISTS public.course_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Wasserzeit',
  amount numeric(10,2) NOT NULL CHECK (amount >= 0 AND amount <= 100000),
  paid_on date,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_course_costs_course ON public.course_costs(course_id);

REVOKE ALL ON public.course_costs FROM anon, authenticated;
GRANT SELECT ON public.course_costs TO authenticated;
GRANT ALL ON public.course_costs TO service_role;
ALTER TABLE public.course_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read course costs" ON public.course_costs
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

COMMENT ON TABLE public.course_costs IS
  'Manuell erfasste Kosten je Kurs (Wasserzeit u. a.) für die Kursergebnis-Übersicht im Vorstandsbereich';
