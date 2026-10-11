-- Reihenfolge der Kursangebote: vom leichtesten zum schwersten (Entwicklungsweg),
-- nicht angebotene (interne) Angebote ans Ende. Zuordnung über den Namen, da die
-- Slugs im Admin angelegter Angebote nicht bekannt sind.
UPDATE public.course_programs SET sort_order = CASE
  WHEN name ILIKE 'Wasserzeit für Babys%'            THEN 10
  WHEN name ILIKE 'Wasserzeit für Kinder%'           THEN 20
  WHEN name ILIKE 'Wassergewöhnung%'                 THEN 30
  WHEN name ILIKE 'Eltern & Kind%'                   THEN 35
  WHEN name ILIKE 'Schwimmstarter%'                  THEN 40
  WHEN name ILIKE 'Anfänger Schwimmen%'              THEN 45
  WHEN name ILIKE '%Seepferdchen%'                   THEN 50
  WHEN name ILIKE '%Bronze, Silber, Gold%'           THEN 90
  WHEN name ILIKE '%Bronze%'                         THEN 60
  WHEN name ILIKE '%Silber%'                         THEN 70
  WHEN name ILIKE '%Gold%'                           THEN 80
  WHEN name ILIKE 'Ferien-Intensiv%'                 THEN 95
  ELSE sort_order
END;

-- Interne (nicht öffentliche) Angebote hinter alle öffentlichen setzen,
-- ihre Reihenfolge untereinander bleibt erhalten.
UPDATE public.course_programs SET sort_order = sort_order + 1000 WHERE is_public = false;
