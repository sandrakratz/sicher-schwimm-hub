-- Privater Speicherbereich für Unterschrift und Vereinsstempel (signature.png, stamp.png).
-- Bewusst OHNE Zugriffsregeln auf storage.objects: Besucher, Mitglieder und Trainer können nichts lesen,
-- nur der Server (Dienstschlüssel) lädt die Dateien beim Erstellen der Teilleistungsnachweise.
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', false)
ON CONFLICT (id) DO NOTHING;
