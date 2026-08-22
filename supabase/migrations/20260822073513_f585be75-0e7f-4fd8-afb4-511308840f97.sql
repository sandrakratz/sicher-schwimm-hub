ALTER TABLE public.course_requests
  ADD COLUMN IF NOT EXISTS referred_sharky boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referred_sharky_at timestamp with time zone;