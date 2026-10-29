-- Mitgliedspreis nur nach Prüfung: Wer "Mitglied" ankreuzt, aber im System nicht als aktives Mitglied
-- gefunden wird, zahlt zunächst den Normalpreis und wird in der Verwaltung zur Prüfung angezeigt.
-- Zahlungsmails (Bestätigung mit Zahlungsaufforderung, Erinnerungen) gehen erst nach der Entscheidung raus.

-- NULL = nichts zu prüfen, pending = Angabe "Mitglied" ungeprüft, verified = bestätigt, rejected = keine Mitgliedschaft
ALTER TABLE public.course_participants
  ADD COLUMN IF NOT EXISTS member_check text;
ALTER TABLE public.course_participants
  DROP CONSTRAINT IF EXISTS course_participants_member_check_chk;
ALTER TABLE public.course_participants
  ADD CONSTRAINT course_participants_member_check_chk
  CHECK (member_check IS NULL OR member_check IN ('pending', 'verified', 'rejected'));
CREATE INDEX IF NOT EXISTS course_participants_member_check_pending_idx
  ON public.course_participants (member_check) WHERE member_check = 'pending';

-- Warteliste: "Mitglied" wurde angegeben, aber nicht bestätigt (is_member bleibt dann leer, kein Vorrang)
ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS member_claimed boolean NOT NULL DEFAULT false;

-- Erwachsenenschwimmen: Angebot für Erwachsene (steuert das passende Buchungsformular)
UPDATE public.course_programs
   SET min_age_years = 18
 WHERE slug = 'erwachsenenschwimmen' AND min_age_years IS NULL;
