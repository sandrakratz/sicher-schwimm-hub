-- Zustimmung der Eltern zu einer Kursumbuchung (per geheimem Link in der Umbuchungs-Mail).
-- Schreibzugriff nur serverseitig (service_role); Staff darf den Status lesen.
CREATE TABLE public.course_transfer_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  participant_id uuid NOT NULL REFERENCES public.course_participants(id) ON DELETE CASCADE,
  from_participant_id uuid REFERENCES public.course_participants(id) ON DELETE SET NULL,
  recipient_email text,
  -- Inhalt der Mail zum Zeitpunkt des Versands (Nachweis, wem genau zugestimmt wurde)
  snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'confirmed')),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX course_transfer_consents_participant_idx ON public.course_transfer_consents (participant_id);

GRANT SELECT ON public.course_transfer_consents TO authenticated;
GRANT ALL ON public.course_transfer_consents TO service_role;
ALTER TABLE public.course_transfer_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read transfer consents" ON public.course_transfer_consents
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
