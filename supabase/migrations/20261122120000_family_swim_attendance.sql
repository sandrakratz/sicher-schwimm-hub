-- Mitgliederschwimmen: Anwesenheit je Person (Versicherungsnachweis, 2 Jahre Aufbewahrung).
-- Der Trainer vor Ort hakt ab, wer tatsächlich da war. NULL = noch nicht erfasst.
-- Es wird eine Momentaufnahme gespeichert: [{ key, name, role: 'adult'|'child', present: boolean }].
-- Kein Geburtsdatum, keine Kontaktdaten.
ALTER TABLE public.family_swim_requests
  ADD COLUMN IF NOT EXISTS attendance jsonb,
  ADD COLUMN IF NOT EXISTS attendance_marked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attendance_marked_at timestamptz;

-- Löschung: nach 6 Monaten Personen-, Kontakt- und Aufsichtsangaben (wie bisher, der Zähler bleibt);
-- die Anwesenheit bleibt als Versicherungsnachweis, bis der Termin 2 Jahre zurückliegt.
CREATE OR REPLACE FUNCTION public.family_swim_scrub()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.family_swim_requests r
  SET persons = '[]'::jsonb, contact_name = NULL, contact_email = NULL,
      grandstand_name = NULL, note = NULL, scrubbed_at = now()
  FROM public.family_swim_events e
  WHERE e.id = r.event_id
    AND r.scrubbed_at IS NULL
    AND e.event_date < (current_date - interval '6 months');
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.family_swim_requests r
  SET attendance = NULL
  FROM public.family_swim_events e
  WHERE e.id = r.event_id
    AND r.attendance IS NOT NULL
    AND e.event_date < (current_date - interval '2 years');

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.family_swim_scrub() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_swim_scrub() TO service_role;
