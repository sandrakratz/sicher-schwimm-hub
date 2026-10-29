-- Erwachsenenschwimmen: unverbindliche Interessenabfrage.
-- Bewusst eigene Tabelle (nicht waitlist_entries): Die Warteliste ist kindbezogen und vergibt Plätze
-- automatisch per Angebot. Interessenten sind weder Teilnehmer noch Mitglieder noch zahlungspflichtig.
-- Schreibzugriff nur serverseitig (Service-Rolle); Lesen/Bearbeiten nur Vorstand/Admin (is_staff).

CREATE TABLE IF NOT EXISTS public.adult_course_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.course_programs(id) ON DELETE RESTRICT,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  -- kleingeschrieben/getrimmt, für die Doppelerkennung
  email_norm text NOT NULL,
  phone text,
  swim_level text NOT NULL CHECK (swim_level IN ('cannot', 'unsure', 'basics')),
  saturday_availability text NOT NULL CHECK (saturday_availability IN ('flexible', 'morning', 'specific')),
  price_preference text NOT NULL CHECK (price_preference IN ('member_159', 'non_member_179', 'check_dates')),
  -- Eigene Angabe im Formular (nur wenn der Status nicht bekannt war)
  member_status_stated text CHECK (member_status_stated IN ('yes', 'no', 'unsure')),
  -- Vom System aus der Mitgliederverwaltung ermittelt (NULL = nicht feststellbar); nur Information
  is_member boolean,
  message text,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'question_open', 'informed', 'not_interested', 'converted')),
  admin_notes text,
  privacy_accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Eine Interessenbekundung je E-Mail-Adresse und Angebot (Doppelte werden serverseitig abgefangen)
CREATE UNIQUE INDEX IF NOT EXISTS adult_course_interests_email_program_uq
  ON public.adult_course_interests (email_norm, program_id);
CREATE INDEX IF NOT EXISTS adult_course_interests_status_idx
  ON public.adult_course_interests (status);

ALTER TABLE public.adult_course_interests ENABLE ROW LEVEL SECURITY;

-- Standardrechte (Supabase vergibt sonst ALL an anon/authenticated) ausdrücklich entziehen, dann nur das Nötige
REVOKE ALL ON public.adult_course_interests FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.adult_course_interests TO authenticated;
GRANT ALL ON public.adult_course_interests TO service_role;

DROP POLICY IF EXISTS "Staff read adult interests" ON public.adult_course_interests;
CREATE POLICY "Staff read adult interests" ON public.adult_course_interests
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff update adult interests" ON public.adult_course_interests;
CREATE POLICY "Staff update adult interests" ON public.adult_course_interests
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff delete adult interests" ON public.adult_course_interests;
CREATE POLICY "Staff delete adult interests" ON public.adult_course_interests
  FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS trg_adult_course_interests_updated ON public.adult_course_interests;
CREATE TRIGGER trg_adult_course_interests_updated
  BEFORE UPDATE ON public.adult_course_interests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Kursangebot: sichtbar in der Kursübersicht, aber NICHT buchbar und ohne Warteliste.
-- Die Buchbarkeit schaltet der Vorstand später in der Kursverwaltung (Angebot bearbeiten → "buchbar") frei.
INSERT INTO public.course_programs (name, slug, target_group, age_range, description, requirements, duration, location, price_member, price_non_member, payment_due_days, is_public, bookable, waitlist_open, sort_order)
SELECT 'Erwachsenenschwimmen – sicher schwimmen lernen', 'erwachsenenschwimmen',
  'Erwachsene', 'ab 18 Jahren',
  E'Schwimmen lernen kennt kein Alter: Du kannst noch nicht richtig schwimmen oder fühlst dich im Wasser unsicher? Wir begleiten dich Schritt für Schritt zu mehr Sicherheit im Wasser – auf Augenhöhe und ohne Leistungsdruck.\n\nGeplanter Start ist Samstag, der 13.02.2027. Die Interessenbekundung ist unverbindlich und kostenfrei.',
  E'Geplanter Start: Samstag, 13.02.2027\nAusschließlich samstags; Uhrzeiten richten sich nach der Belegung der Sportschule und können variieren\n10 Termine mit je 45 Minuten Wasserzeit\nKleine Lerngruppe mit zunächst maximal 8 Teilnehmenden',
  '10 Termine à 45 Minuten', 'Sportschule Hennef', 159, 179, 14, true, false, false, 62
WHERE NOT EXISTS (SELECT 1 FROM public.course_programs WHERE slug = 'erwachsenenschwimmen');
