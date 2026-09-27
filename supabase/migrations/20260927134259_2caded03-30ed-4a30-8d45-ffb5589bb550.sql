ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS min_participants integer,
  ADD COLUMN IF NOT EXISTS lanes smallint,
  ADD COLUMN IF NOT EXISTS start_tentative boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tentative_note text;

INSERT INTO public.course_programs (name, slug, target_group, age_range, description, requirements, duration, location, price_member, price_non_member, payment_due_days, is_public, bookable, sort_order)
SELECT 'Schwimmabzeichen Aufbaukurs (Bronze, Silber, Gold)', 'schwimmabzeichen-aufbaukurs',
  'Kinder mit Seepferdchen oder Bronze', 'ab 6 Jahren',
  E'Gemeinsames Training für Kinder, die das Schwimmabzeichen Bronze, Silber oder Gold ablegen möchten – inklusive Abnahme der Abzeichen nach der Deutschen Prüfungsordnung Schwimmen.\n\nJedes Kind trainiert auf seinem Niveau, auf 2 Bahnen mit 45 Minuten pro Einheit.',
  E'Seepferdchen (für Bronze) bzw. vorheriges Abzeichen\nMindestens 14 Kinder, sonst kann der Kurs vor Beginn abgesagt werden',
  '45 Minuten pro Einheit', 'Sportschule Hennef', 150, 200, 14, true, true, 50
WHERE NOT EXISTS (SELECT 1 FROM public.course_programs WHERE slug = 'schwimmabzeichen-aufbaukurs');