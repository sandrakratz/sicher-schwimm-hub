-- Höchstalter eines Kursangebots (Jahre zu Kursbeginn, einschließlich; leer = keine Obergrenze).
-- Beispiel: 5 = Kinder bis einschließlich 5 Jahre, am 6. Geburtstag nicht mehr.
ALTER TABLE public.course_programs ADD COLUMN IF NOT EXISTS max_age_years numeric;
