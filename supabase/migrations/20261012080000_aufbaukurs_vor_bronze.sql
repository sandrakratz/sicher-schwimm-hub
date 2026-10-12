-- Aufbaukurs (Bronze, Silber, Gold) steht vor Bronze: Seepferdchen 50 → Aufbaukurs 55 → Bronze 60.
-- Interne (nicht öffentliche) Angebote behalten ihren Abstand von +1000.
UPDATE public.course_programs
SET sort_order = 55 + CASE WHEN is_public = false THEN 1000 ELSE 0 END
WHERE name ILIKE '%Bronze, Silber, Gold%';
