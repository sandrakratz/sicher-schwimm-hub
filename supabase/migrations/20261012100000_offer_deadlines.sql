-- Angebotsfristen für Platzangebote von der Warteliste: je nach Abstand zum Kursbeginn
-- (Standard: Beginn in 4 Wochen oder mehr = 5 Tage, sonst 3 Tage) und optional je Kurszeitraum abweichend.
CREATE TABLE IF NOT EXISTS public.offer_deadline_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  far_weeks integer NOT NULL DEFAULT 4 CHECK (far_weeks BETWEEN 1 AND 52),
  days_far integer NOT NULL DEFAULT 5 CHECK (days_far BETWEEN 1 AND 60),
  days_near integer NOT NULL DEFAULT 3 CHECK (days_near BETWEEN 1 AND 60),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
-- Zugriff nur über die Server-Funktionen (Service-Rolle); keine Richtlinien = kein direkter Zugriff
ALTER TABLE public.offer_deadline_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.offer_deadline_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- Eigene Frist für einen einzelnen Kurszeitraum (leer = Regel nach Kursbeginn)
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS offer_days_override integer
  CHECK (offer_days_override IS NULL OR offer_days_override BETWEEN 1 AND 60);
