-- Zuständigkeit und Wiedervorlage bei Einträgen der Anfrageliste.
ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS assigned_to text,
  ADD COLUMN IF NOT EXISTS follow_up_on date;
