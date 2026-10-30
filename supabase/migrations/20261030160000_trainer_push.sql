-- Push-Mitteilungen an Trainer:innen (Geräte-Abos). Geschrieben wird nur über Server-Funktionen (Service-Rolle);
-- Trainer:innen dürfen ihre eigenen Abos lesen.
CREATE TABLE IF NOT EXISTS public.trainer_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trainer_push_trainer ON public.trainer_push_subscriptions(trainer_id);

GRANT SELECT ON public.trainer_push_subscriptions TO authenticated;
GRANT ALL ON public.trainer_push_subscriptions TO service_role;
ALTER TABLE public.trainer_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trainers read own push subscriptions" ON public.trainer_push_subscriptions
  FOR SELECT TO authenticated USING (trainer_id = auth.uid());
