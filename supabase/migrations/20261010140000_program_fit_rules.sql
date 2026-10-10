-- „Passt das?“-Prüfung vor automatischen Platzangeboten: Mindest-Schwimmniveau und Kurstag je Angebot.
-- Stufen: 0 Keine Wassererfahrung, 1 Wassergewöhnt, 2 Erste Schwimmversuche, 3 Seepferdchen,
--         4 Sicherer Schwimmer, 5 Bronze, 6 Silber, 7 Gold. Wochentag: 1 = Montag … 6 = Samstag, 7 = Sonntag.
ALTER TABLE public.course_programs
  ADD COLUMN IF NOT EXISTS min_swim_level smallint,
  ADD COLUMN IF NOT EXISTS weekday smallint;

-- Vorbelegung nach den Vorgaben des Vorstands (jederzeit in der Kursverwaltung änderbar).
UPDATE public.course_programs SET min_swim_level = 0, weekday = 7 WHERE name ILIKE 'Wasserzeit%';
UPDATE public.course_programs SET min_swim_level = 1, weekday = 7 WHERE name ILIKE 'Schwimmstarter%';
UPDATE public.course_programs SET min_swim_level = 2, weekday = 6 WHERE name ILIKE '%Seepferdchen%';
UPDATE public.course_programs SET min_swim_level = 3, weekday = 6 WHERE name ILIKE 'Schwimmabzeichen Bronze%';
UPDATE public.course_programs SET min_swim_level = 5, weekday = 6 WHERE name ILIKE 'Schwimmabzeichen Silber%';
UPDATE public.course_programs SET min_swim_level = 6, weekday = 6 WHERE name ILIKE 'Schwimmabzeichen Gold%';
-- Aufbaukurs (Bronze, Silber, Gold): niedrigste Stufe der enthaltenen Abzeichen
UPDATE public.course_programs SET min_swim_level = 3, weekday = 6 WHERE name ILIKE 'Schwimmabzeichen Aufbaukurs%';
