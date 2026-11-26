-- Führungszeugnisse (Vorstand 27.11.2026): Trainer:innen reichen spätestens alle 2 Jahre ein neues
-- erweitertes Führungszeugnis ein; der Verein muss für die ganze Tätigkeit nachweisen, dass er jeweils
-- Einsicht genommen hat. Gespeichert wird nur die Tatsache der Einsicht (§ 72a SGB VIII), nie das Zeugnis.
--
-- 1) trainer_fz_checks: Prüf-Historie, nur anfügen, nie überschreiben. Ohne Fremdschlüssel auf das Konto,
--    damit der Nachweis auch nach Löschen eines Kontos bleibt (Name als Kopie).
-- 2) trainer_departures: Datum, an dem die Rolle „Trainer/in“ entfernt wurde (für die spätere Löschfrist).
-- 3) Führungszeugnis: „gültig bis“ = Ausstellungsdatum + 2 Jahre (Erinnerungen greifen darüber).
-- Löscht nichts.

CREATE TABLE IF NOT EXISTS public.trainer_fz_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL,
  trainer_name text NOT NULL,
  issued_on date,
  checked_at timestamptz NOT NULL DEFAULT now(),
  checked_by uuid,
  checked_by_name text
);
CREATE INDEX IF NOT EXISTS trainer_fz_checks_trainer_idx ON public.trainer_fz_checks (trainer_id, checked_at);
REVOKE ALL ON public.trainer_fz_checks FROM anon, authenticated;
GRANT SELECT ON public.trainer_fz_checks TO authenticated;
GRANT ALL ON public.trainer_fz_checks TO service_role;
ALTER TABLE public.trainer_fz_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read fz checks" ON public.trainer_fz_checks;
CREATE POLICY "Staff read fz checks" ON public.trainer_fz_checks
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
COMMENT ON TABLE public.trainer_fz_checks IS
  'Nachweis der Einsichtnahme in erweiterte Führungszeugnisse (§ 72a SGB VIII) – je Einsicht eine Zeile, nie überschrieben';

-- Bisherige Prüfvermerke als Startbestand übernehmen (nur einmal)
INSERT INTO public.trainer_fz_checks (trainer_id, trainer_name, issued_on, checked_at, checked_by, checked_by_name)
SELECT c.trainer_id,
       coalesce(nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), p.email, '?'),
       q.issued_on,
       c.checked_at,
       c.checked_by,
       nullif(trim(coalesce(pb.first_name, '') || ' ' || coalesce(pb.last_name, '')), '')
  FROM public.trainer_qualification_checks c
  LEFT JOIN public.trainer_qualifications q ON q.trainer_id = c.trainer_id AND q.kind = 'fuehrungszeugnis'
  LEFT JOIN public.profiles p ON p.id = c.trainer_id
  LEFT JOIN public.profiles pb ON pb.id = c.checked_by
 WHERE c.kind = 'fuehrungszeugnis'
   AND NOT EXISTS (SELECT 1 FROM public.trainer_fz_checks x WHERE x.trainer_id = c.trainer_id);

CREATE TABLE IF NOT EXISTS public.trainer_departures (
  trainer_id uuid PRIMARY KEY,
  trainer_name text,
  left_at date NOT NULL DEFAULT current_date
);
REVOKE ALL ON public.trainer_departures FROM anon, authenticated;
GRANT SELECT ON public.trainer_departures TO authenticated;
GRANT ALL ON public.trainer_departures TO service_role;
ALTER TABLE public.trainer_departures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read departures" ON public.trainer_departures;
CREATE POLICY "Staff read departures" ON public.trainer_departures
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
COMMENT ON TABLE public.trainer_departures IS
  'Rolle „Trainer/in“ entfernt am – Beginn der Löschfrist für Führungszeugnis-Nachweise';

CREATE OR REPLACE FUNCTION public.track_trainer_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.role = 'trainer' THEN
    INSERT INTO public.trainer_departures (trainer_id, trainer_name, left_at)
    VALUES (
      OLD.user_id,
      (SELECT nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '')
         FROM public.profiles WHERE id = OLD.user_id),
      current_date)
    ON CONFLICT (trainer_id) DO UPDATE
      SET left_at = EXCLUDED.left_at,
          trainer_name = coalesce(EXCLUDED.trainer_name, public.trainer_departures.trainer_name);
  ELSIF TG_OP = 'INSERT' AND NEW.role = 'trainer' THEN
    DELETE FROM public.trainer_departures WHERE trainer_id = NEW.user_id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_track_trainer_role ON public.user_roles;
CREATE TRIGGER trg_track_trainer_role
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.track_trainer_role();

CREATE OR REPLACE FUNCTION public.fz_valid_two_years()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind = 'fuehrungszeugnis' AND NEW.issued_on IS NOT NULL THEN
    NEW.valid_until := (NEW.issued_on + interval '2 years')::date;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fz_valid_two_years ON public.trainer_qualifications;
CREATE TRIGGER trg_fz_valid_two_years
  BEFORE INSERT OR UPDATE ON public.trainer_qualifications
  FOR EACH ROW EXECUTE FUNCTION public.fz_valid_two_years();
