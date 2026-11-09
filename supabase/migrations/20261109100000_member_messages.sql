-- Nachrichten vom Vorstand an ausgewählte Mitglieder.
--
--  * member_messages           – die Nachricht (Betreff, Text, Absender)
--  * member_message_recipients – eine Zeile je Empfänger:in (Konto), mit Lesestatus und Mailstatus
--
-- Die Nachricht liegt im Mitgliedskonto („Postfach“); zusätzlich geht eine kurze Hinweis-Mail
-- ohne den Nachrichtentext an die Konto-Adresse. Schreibzugriff nur serverseitig (Service-Rolle).
-- Mitglieder lesen nur Nachrichten, die an ihr Konto gerichtet sind; Vorstand/Admin (is_staff) alles.

CREATE TABLE IF NOT EXISTS public.member_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.member_message_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.member_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz,
  -- Hinweis-Mail: pending = noch nicht versucht, sent = verschickt, failed = Fehler, skipped = z. B. Adresse gesperrt
  mail_status text NOT NULL DEFAULT 'pending' CHECK (mail_status IN ('pending', 'sent', 'failed', 'skipped')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS member_message_recipients_user_idx
  ON public.member_message_recipients (user_id, created_at DESC);

ALTER TABLE public.member_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_message_recipients ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.member_messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.member_message_recipients FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.member_messages TO authenticated;
GRANT SELECT ON public.member_message_recipients TO authenticated;
GRANT ALL ON public.member_messages TO service_role;
GRANT ALL ON public.member_message_recipients TO service_role;

DROP POLICY IF EXISTS "Recipient or staff read member messages" ON public.member_messages;
CREATE POLICY "Recipient or staff read member messages" ON public.member_messages
  FOR SELECT TO authenticated USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.member_message_recipients r
      WHERE r.message_id = member_messages.id AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Own or staff read member message recipients" ON public.member_message_recipients;
CREATE POLICY "Own or staff read member message recipients" ON public.member_message_recipients
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
