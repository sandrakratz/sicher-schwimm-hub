CREATE TABLE public.course_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  target_group text,
  age_range text,
  min_age_years numeric,
  description text,
  requirements text,
  duration text,
  location text,
  price_member numeric,
  price_non_member numeric,
  payment_due_days integer NOT NULL DEFAULT 14,
  is_public boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.course_programs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_programs TO authenticated;
GRANT ALL ON public.course_programs TO service_role;

ALTER TABLE public.course_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view public programs" ON public.course_programs
  FOR SELECT TO anon, authenticated
  USING (is_public = true OR is_staff(auth.uid()) OR has_role(auth.uid(), 'trainer'::app_role));

CREATE POLICY "Staff or trainer manage programs" ON public.course_programs
  FOR ALL TO authenticated
  USING (is_staff(auth.uid()) OR has_role(auth.uid(), 'trainer'::app_role))
  WITH CHECK (is_staff(auth.uid()) OR has_role(auth.uid(), 'trainer'::app_role));

CREATE TRIGGER trg_course_programs_updated
  BEFORE UPDATE ON public.course_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.courses ADD COLUMN program_id uuid REFERENCES public.course_programs(id) ON DELETE SET NULL;
CREATE INDEX idx_courses_program_id ON public.courses(program_id);

ALTER TABLE public.course_participants ADD COLUMN online_booking boolean NOT NULL DEFAULT false;

INSERT INTO public.course_programs (name, slug, target_group, age_range, min_age_years, description, requirements, duration, location, price_member, price_non_member, sort_order) VALUES
('Wassergewöhnung', 'wassergewoehnung', 'Kinder', '3–5 Jahre', 3, 'Spielerische erste Erfahrungen im Wasser ohne Leistungsdruck.', 'Keine Voraussetzungen.', '10 Wochen', 'Schwimmbad im Rhein-Sieg-Kreis (genauer Kursort wird rechtzeitig bekannt gegeben)', 150, 200, 10),
('Eltern & Kind', 'eltern-kind', 'Familien', '1–3 Jahre', 1, 'Gemeinsame Wasserzeit für Eltern mit Kleinkindern.', 'Keine Voraussetzungen.', '8 Wochen', 'Schwimmbad im Rhein-Sieg-Kreis (genauer Kursort wird rechtzeitig bekannt gegeben)', NULL, NULL, 20),
('Anfänger Schwimmen', 'anfaenger-schwimmen', 'Kinder', 'ab 5 Jahre', 5, 'Erste Schwimmtechniken und Sicherheit im Wasser.', 'Keine Angst vor Wasser, ggf. altersgerechte Motorik (Hampelmann, Laufrad-/Fahrradfahren).', '12 Wochen', 'Schwimmbad im Rhein-Sieg-Kreis (genauer Kursort wird rechtzeitig bekannt gegeben)', 150, 200, 30),
('Schwimmabzeichen Seepferdchen', 'seepferdchen', 'Kinder', '5–8 Jahre', 5, 'Gezielte Vorbereitung auf das Seepferdchen-Abzeichen.', 'Kopf unter Wasser nehmen, Springen ins Wasser, Motorik Hampelmann.', '10 Wochen', 'Schwimmbad im Rhein-Sieg-Kreis (genauer Kursort wird rechtzeitig bekannt gegeben)', 150, 200, 40),
('Schwimmabzeichen Bronze', 'bronze', 'Kinder/Jugend', 'ab 7 Jahre', 7, 'Sicheres Schwimmen über längere Strecken.', 'Bedingungen des Seepferdchen-Abzeichens müssen erfüllt sein.', '10 Wochen', 'Schwimmbad im Rhein-Sieg-Kreis (genauer Kursort wird rechtzeitig bekannt gegeben)', 150, 200, 50),
('Schwimmabzeichen Silber', 'silber', 'Kinder/Jugend', 'ab 9 Jahre', 9, 'Erweiterte Technik und Ausdauer.', 'Bedingungen des Bronze-Abzeichens müssen erfüllt sein.', '10 Wochen', 'Schwimmbad im Rhein-Sieg-Kreis (genauer Kursort wird rechtzeitig bekannt gegeben)', 150, 200, 60),
('Ferien-Intensivkurse', 'ferien-intensivkurse', 'Kinder', '5–10 Jahre', 5, 'Schnell ins Schwimmen kommen in den Ferien.', 'Je nach Kursniveau – bitte bei Anfrage angeben.', '5 Tage', 'Schwimmbad im Rhein-Sieg-Kreis (genauer Kursort wird rechtzeitig bekannt gegeben)', NULL, NULL, 70);

INSERT INTO public.course_programs (name, slug, target_group, age_range, min_age_years, description, requirements, duration, location, price_member, price_non_member, sort_order) VALUES
('Seepferdchen im Kurhaus', 'seepferdchen-kurhaus', 'Kinder die das Seepferdchen erlangen möchten und keine Angst vor dem Element Wasser haben', 'ab 5 Jahre', 5, 'Seepferdchen-Kurs im Kurhaus Hennef – gezielte Vorbereitung auf das Seepferdchen-Abzeichen in kleinen Gruppen.', 'Kopf unter Wasser nehmen, Springen ins Wasser, Motorik Hampelmann.', '5 Wochen', 'Kurhausstr. 27, 53773 Hennef', 150, 200, 35);

UPDATE public.courses
SET program_id = (SELECT id FROM public.course_programs WHERE slug = 'seepferdchen-kurhaus')
WHERE id IN ('80f6d29f-a7bc-435b-9028-04e64cc202b4', '99318761-3749-4015-9912-8366ce3382ee');