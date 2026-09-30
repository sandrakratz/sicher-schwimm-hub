-- Speicherbereiche für Dokumente und Medien (bisher von Lovable Cloud angelegt, nicht in den Migrationen enthalten).
-- Beide sind privat; der Zugriff läuft über die bestehenden Regeln auf storage.objects bzw. über signierte Links.
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false), ('media', 'media', false)
ON CONFLICT (id) DO NOTHING;
