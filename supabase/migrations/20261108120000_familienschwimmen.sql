-- Familienschwimmen für Vereinsmitglieder (Sportschule Hennef, 12:00–12:45 Uhr).
--
-- Aufbau:
--  * family_swim_events    – die einzelnen Termine (Kapazität 8–10 Personen, Anmeldeschluss, Status)
--  * family_swim_requests  – eine Anmeldung je Konto und Termin (Personen aus dem Mitgliedskonto)
--  * family_swim_standing  – Ansicht mit Teilnahmen, Strafpunkten und letzter Teilnahme je Konto
--  * family_swim_confirm() – vergibt Plätze atomar (sperrt den Termin, keine Überbuchung)
--  * family_swim_scrub()   – löscht 6 Monate nach dem Termin die personenbezogenen Angaben, der Zähler bleibt
--
-- Schreibzugriff nur serverseitig (Service-Rolle). Mitglieder lesen nur ihre eigenen Anmeldungen,
-- Vorstand/Admin (is_staff) alles. Teilnehmerlisten sind für andere Mitglieder nie sichtbar.

CREATE TABLE IF NOT EXISTS public.family_swim_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date date NOT NULL UNIQUE,
  start_time time NOT NULL DEFAULT '12:00',
  end_time time NOT NULL DEFAULT '12:45',
  location text NOT NULL DEFAULT 'Sportschule Hennef',
  capacity integer NOT NULL DEFAULT 10 CHECK (capacity BETWEEN 8 AND 10),
  -- Anmeldeschluss; danach vergibt der Vorstand die Plätze
  registration_deadline timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'inactive', 'cancelled')),
  -- gesetzt, sobald die Vergabe für diesen Termin durchgeführt wurde
  allocated_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.family_swim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.family_swim_events(id) ON DELETE CASCADE,
  -- Anmeldung nur über das Konto; die Zählung (Teilnahmen, Strafpunkte) hängt an diesem Konto
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- fasst die Termine einer gemeinsamen Anmeldung zusammen (eine Mail je Anmeldung)
  batch_id uuid NOT NULL,
  contact_name text,
  contact_email text,
  -- [{ key, name, role: 'adult'|'child', date_of_birth, membership_id }] – nur Personen aus dem Konto
  persons jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Personen im Wasser (zählen zur Kapazität); die Aufsichtsperson auf der Tribüne zählt nicht
  seats integer NOT NULL CHECK (seats BETWEEN 1 AND 10),
  grandstand_name text,
  bronze_confirmed boolean NOT NULL DEFAULT false,
  note text,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'confirmed', 'waitlist', 'declined', 'cancelled', 'attended', 'no_show')),
  -- Strafpunkt: späte Absage (weniger als 48 Stunden vorher) oder nicht erschienen
  strike boolean NOT NULL DEFAULT false,
  strike_waived boolean NOT NULL DEFAULT false,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  cancelled_at timestamptz,
  scrubbed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Schutz vor Mehrfachanmeldungen: je Konto und Termin höchstens eine aktive Anmeldung
CREATE UNIQUE INDEX IF NOT EXISTS family_swim_requests_active_uq
  ON public.family_swim_requests (event_id, user_id) WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS family_swim_requests_event_idx ON public.family_swim_requests (event_id, status);
CREATE INDEX IF NOT EXISTS family_swim_requests_user_idx ON public.family_swim_requests (user_id);

ALTER TABLE public.family_swim_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_swim_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.family_swim_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.family_swim_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.family_swim_events TO authenticated;
GRANT SELECT ON public.family_swim_requests TO authenticated;
GRANT ALL ON public.family_swim_events TO service_role;
GRANT ALL ON public.family_swim_requests TO service_role;

DROP POLICY IF EXISTS "Members read family swim events" ON public.family_swim_events;
CREATE POLICY "Members read family swim events" ON public.family_swim_events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Own or staff read family swim requests" ON public.family_swim_requests;
CREATE POLICY "Own or staff read family swim requests" ON public.family_swim_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS trg_family_swim_events_updated ON public.family_swim_events;
CREATE TRIGGER trg_family_swim_events_updated
  BEFORE UPDATE ON public.family_swim_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_family_swim_requests_updated ON public.family_swim_requests;
CREATE TRIGGER trg_family_swim_requests_updated
  BEFORE UPDATE ON public.family_swim_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Teilnahmezähler je Konto. Nur „Teilgenommen“ zählt als Teilnahme; Strafpunkte nur ohne Entschuldigung.
-- Die Zeilen bleiben auch nach dem Löschen der Personenangaben bestehen (family_swim_scrub).
CREATE OR REPLACE VIEW public.family_swim_standing
WITH (security_invoker = on) AS
SELECT
  r.user_id,
  count(*) FILTER (WHERE r.status = 'attended') AS participations,
  count(*) FILTER (WHERE r.strike AND NOT r.strike_waived) AS strikes,
  max(e.event_date) FILTER (WHERE r.status = 'attended') AS last_participation
FROM public.family_swim_requests r
JOIN public.family_swim_events e ON e.id = r.event_id
GROUP BY r.user_id;
GRANT SELECT ON public.family_swim_standing TO authenticated, service_role;

-- Vergibt einen Platz atomar. Der Termin wird gesperrt, damit zwei gleichzeitige Vergaben
-- nie dieselben letzten Plätze erhalten. Rückgabe: ok | full | event_closed | bad_status | not_found
CREATE OR REPLACE FUNCTION public.family_swim_confirm(p_request_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.family_swim_requests;
  e public.family_swim_events;
  used integer;
BEGIN
  SELECT * INTO r FROM public.family_swim_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;

  SELECT * INTO e FROM public.family_swim_events WHERE id = r.event_id FOR UPDATE;
  IF e.status <> 'open' THEN RETURN 'event_closed'; END IF;

  -- nach dem Sperren neu lesen: der Status kann sich inzwischen geändert haben
  SELECT * INTO r FROM public.family_swim_requests WHERE id = p_request_id FOR UPDATE;
  IF r.status NOT IN ('requested', 'waitlist', 'declined') THEN RETURN 'bad_status'; END IF;

  SELECT coalesce(sum(seats), 0) INTO used
  FROM public.family_swim_requests
  WHERE event_id = e.id AND status IN ('confirmed', 'attended', 'no_show');

  IF used + r.seats > e.capacity THEN RETURN 'full'; END IF;

  UPDATE public.family_swim_requests
  SET status = 'confirmed', decided_at = now()
  WHERE id = p_request_id;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.family_swim_confirm(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_swim_confirm(uuid) TO service_role;

-- Datensparsamkeit: 6 Monate nach dem Termin werden Namen, Geburtsdaten, Kontaktdaten, Aufsichtsperson
-- und Hinweise entfernt. Status, Strafpunkt und Termin bleiben, damit der Zähler erhalten bleibt.
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
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.family_swim_scrub() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_swim_scrub() TO service_role;

-- Täglich um 03:30 UTC ausführen (nur wenn pg_cron verfügbar ist)
DO $$
BEGIN
  PERFORM cron.schedule('family-swim-scrub-daily', '30 3 * * *', 'select public.family_swim_scrub()');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron nicht verfügbar – family_swim_scrub bitte manuell planen: %', SQLERRM;
END;
$$;

-- Die sieben ersten Termine. Anmeldeschluss: sieben Tage vor dem Termin, 23:59 Uhr (Berlin).
INSERT INTO public.family_swim_events (event_date, capacity, registration_deadline)
SELECT d, 10, ((d - 7)::timestamp + time '23:59') AT TIME ZONE 'Europe/Berlin'
FROM unnest(ARRAY[
  DATE '2026-11-21', DATE '2026-12-12', DATE '2026-12-19',
  DATE '2027-01-09', DATE '2027-01-16', DATE '2027-01-23', DATE '2027-01-30'
]) AS d
ON CONFLICT (event_date) DO NOTHING;
