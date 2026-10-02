-- Trainer:innen greifen auf Teilnehmerdaten nur noch über die Server-Funktionen zu (listMyTrainerCourses,
-- updateParticipantHint/Phone/Result, Exporte), die gezielt nur die nötigen Felder liefern bzw. ändern.
-- Bisher durften Trainer per Datenbank-Zugriff
--   * ALLE Spalten der Teilnehmer ihrer Kurse ändern (z. B. paid, price_amount, status, document_no) und
--   * ALLE Spalten lesen (Rechnungsadresse, Preis, interne Notizen).
-- Eltern (eigene Buchungen) und Vorstand/Admin bleiben unverändert.
DROP POLICY IF EXISTS "Trainers update own course enrollments" ON public.course_participants;

DROP POLICY IF EXISTS "Users view own enrollments" ON public.course_participants;
CREATE POLICY "Users view own enrollments" ON public.course_participants
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR auth.uid() = parent_user_id
  OR is_staff(auth.uid())
);
