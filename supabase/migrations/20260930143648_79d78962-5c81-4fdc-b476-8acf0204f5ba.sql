ALTER TABLE public.course_participants ADD COLUMN IF NOT EXISTS push_token text UNIQUE;

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.course_participants(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, endpoint)
);
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view push subscriptions" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
GRANT SELECT ON public.push_subscriptions TO authenticated;
CREATE TRIGGER trg_push_subscriptions_updated BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();