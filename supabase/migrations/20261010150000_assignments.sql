-- Zuständigkeiten: Nachrichten und offene Zahlungen können einem Vorstandsmitglied zugewiesen werden
-- (Anfrageliste-Einträge haben assigned_to schon). Standard-Zuständigkeiten je Bereich in assignment_rules.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS assigned_to text;
ALTER TABLE public.course_participants ADD COLUMN IF NOT EXISTS assigned_to text;

CREATE TABLE IF NOT EXISTS public.assignment_rules (
  area text PRIMARY KEY CHECK (area IN ('payments', 'messages', 'waitlist')),
  assignee text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
-- Zugriff nur über die Server-Funktionen (Service-Rolle); keine Richtlinien = kein direkter Zugriff
ALTER TABLE public.assignment_rules ENABLE ROW LEVEL SECURITY;

-- Vorbelegung: Zahlungen kümmert sich Manuela (Kasse)
INSERT INTO public.assignment_rules (area, assignee)
VALUES ('payments', 'Manuela Scholz-Ornowski')
ON CONFLICT (area) DO NOTHING;
