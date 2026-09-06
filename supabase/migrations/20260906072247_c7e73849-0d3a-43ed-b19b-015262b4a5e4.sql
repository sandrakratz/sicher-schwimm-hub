ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS course_info text;
ALTER TABLE public.course_programs ADD COLUMN IF NOT EXISTS course_info text;