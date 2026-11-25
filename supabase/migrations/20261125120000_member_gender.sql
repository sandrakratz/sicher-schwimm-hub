-- Geschlecht der Mitglieder für die Bestandsmeldung an den Landessportbund (LSB NRW).
-- Hauptmitglied: Spalte memberships.gender; Partner:in und Kinder: Schlüssel "gender" im JSON
-- memberships.family_members (dafür ist keine Änderung nötig).
-- Werte: 'w' = weiblich, 'm' = männlich, 'd' = divers. Bestehende Mitglieder trägt der Vorstand nach.

ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS gender text;

ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS memberships_gender_check;
ALTER TABLE public.memberships
  ADD CONSTRAINT memberships_gender_check CHECK (gender IS NULL OR gender IN ('w', 'm', 'd'));

COMMENT ON COLUMN public.memberships.gender IS
  'Geschlecht des Hauptmitglieds (w/m/d) für die Bestandsmeldung an den Landessportbund';
