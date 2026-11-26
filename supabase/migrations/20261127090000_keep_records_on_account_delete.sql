-- Löschkonzept 2027, Schritt 1 (Vorstand 26.11.2026): Wird ein Konto gelöscht (z. B. automatisch 30 Tage
-- nach Ende der Mitgliedschaft), dürfen Nachweise mit eigener Aufbewahrungsfrist nicht mitverschwinden:
--   * Mitgliederschwimmen-Anmeldungen samt Anwesenheit (2 Jahre, Versicherungsnachweis)
--   * Kursbuchungen mit Konto-Verknüpfung (Beleg 8 Jahre, Anwesenheit 2 Jahre, Prüfung 5 Jahre)
-- Statt ON DELETE CASCADE nun ON DELETE SET NULL: die Zeile bleibt, nur die Verknüpfung zum Konto entfällt.
-- Gelöscht werden diese Daten später durch die Löschjobs nach ihren Fristen.
-- Außerdem: „erfasst von“-Spalten ohne ON DELETE blockierten das Löschen von Trainerkonten → SET NULL.
-- Löscht keine Daten. Idempotent (kann mehrfach laufen).

ALTER TABLE public.family_swim_requests ALTER COLUMN user_id DROP NOT NULL;

DO $$
DECLARE
  t text[];
  c text;
BEGIN
  FOREACH t SLICE 1 IN ARRAY ARRAY[
    ['family_swim_requests', 'user_id'],
    ['course_participants', 'user_id'],
    ['course_participants', 'exam_recorded_by'],
    ['course_attendance', 'recorded_by'],
    ['trainer_session_attendance', 'recorded_by'],
    ['trainer_session_attendance', 'confirmed_by']
  ] LOOP
    -- bisherigen Fremdschlüssel dieser Spalte auf auth.users entfernen …
    FOR c IN
      SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
       WHERE con.contype = 'f'
         AND con.conrelid = format('public.%I', t[1])::regclass
         AND con.confrelid = 'auth.users'::regclass
         AND a.attname = t[2]
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t[1], c);
    END LOOP;
    -- … und mit ON DELETE SET NULL neu anlegen
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL',
      t[1], t[1] || '_' || t[2] || '_fkey', t[2]);
  END LOOP;
END $$;

-- Anmeldungen ohne Konto (ehemalige Mitglieder) zählen in keiner Familien-Statistik mehr.
CREATE OR REPLACE VIEW public.family_swim_standing
WITH (security_invoker = on) AS
SELECT
  r.user_id,
  count(*) FILTER (WHERE r.status = 'attended') AS participations,
  count(*) FILTER (WHERE r.strike AND NOT r.strike_waived) AS strikes,
  max(e.event_date) FILTER (WHERE r.status = 'attended') AS last_participation
FROM public.family_swim_requests r
JOIN public.family_swim_events e ON e.id = r.event_id
WHERE r.user_id IS NOT NULL
GROUP BY r.user_id;
