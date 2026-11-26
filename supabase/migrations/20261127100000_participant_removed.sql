-- Löschkonzept 2027, Schritt 2 (Vorstand 26.11.2026): „Teilnehmer entfernen“ löscht die Buchung nicht mehr,
-- sondern nimmt das Kind sichtbar aus dem Kurs (status = 'cancelled' + removed_at). Buchung, Zahlung,
-- Anwesenheit und Prüfung bleiben erhalten und werden später nach ihren Fristen gelöscht.
-- removed_at unterscheidet „vom Verein herausgenommen“ von einer Absage der Familie (cancelled_at),
-- damit es nicht als Absage der Familie zählt. Nur neue Spalten, löscht nichts.

ALTER TABLE public.course_participants
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.course_participants.removed_at IS
  'Vom Verein aus dem Kurs genommen (Grund in cancel_reason); Buchung bleibt bis zum Ablauf der Fristen';
