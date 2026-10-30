-- Abgerechnete Stunden je Termin: Standard je Kursart, bei Bedarf je Kurs/Event überschrieben.
-- Die tatsächliche Einsatzzeit (z. B. frühes Einbuchen) spielt für die Vergütung keine Rolle.
ALTER TABLE public.course_programs
  ADD COLUMN IF NOT EXISTS billed_hours numeric(4,2) CHECK (billed_hours IS NULL OR (billed_hours > 0 AND billed_hours <= 12));
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS billed_hours numeric(4,2) CHECK (billed_hours IS NULL OR (billed_hours > 0 AND billed_hours <= 12));

COMMENT ON COLUMN public.course_programs.billed_hours IS
  'Standard: pro Termin an Trainer:innen abgerechnete Stunden (Übungsleitergelder)';
COMMENT ON COLUMN public.courses.billed_hours IS
  'Überschreibt billed_hours der Kursart; NULL = Standard der Kursart';

-- Startwerte laut Vorstand (nur wo noch nichts eingetragen ist)
UPDATE public.course_programs SET billed_hours = 2
  WHERE billed_hours IS NULL AND slug = 'seepferdchen-kurhaus';
UPDATE public.course_programs SET billed_hours = 1
  WHERE billed_hours IS NULL AND (
    name ILIKE 'Wasserzeit%'
    OR name ILIKE 'Schwimmstarter%'
    OR slug IN ('seepferdchen', 'bronze', 'silber', 'gold', 'schwimmabzeichen-aufbaukurs')
  );
