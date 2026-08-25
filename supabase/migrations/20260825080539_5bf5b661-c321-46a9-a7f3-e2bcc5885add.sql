CREATE OR REPLACE FUNCTION public.is_trainer_of_profile(_trainer_id uuid, _profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.course_participants cp
    JOIN public.courses c ON c.id = cp.course_id
    WHERE (cp.user_id = _profile_id OR cp.parent_user_id = _profile_id)
      AND cp.status <> 'cancelled'
      AND (
        c.trainer_id = _trainer_id
        OR EXISTS (
          SELECT 1
          FROM public.course_sessions cs
          JOIN public.course_session_assignments csa ON csa.session_id = cs.id
          WHERE cs.course_id = c.id AND csa.trainer_id = _trainer_id
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION public.is_trainer_of_profile(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_trainer_of_profile(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Trainers view active members" ON public.profiles;

CREATE POLICY "Trainers view own course members"
ON public.profiles FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'trainer'::app_role)
  AND status = 'active'::account_status
  AND public.is_trainer_of_profile(auth.uid(), profiles.id)
);