CREATE OR REPLACE FUNCTION pg_temp.lastw(t text) RETURNS text LANGUAGE sql AS $$ SELECT CASE WHEN trim(coalesce(t,'')) ~ '\s' THEN regexp_replace(trim(t), '^.*\s', '') END $$;
UPDATE public.waitlist_entries SET child_name = trim(child_name)||' '||pg_temp.lastw(parent_name)
 WHERE child_name IS NOT NULL AND trim(child_name) !~ '\s' AND pg_temp.lastw(parent_name) IS NOT NULL;
UPDATE public.course_requests SET child_name = trim(child_name)||' '||pg_temp.lastw(parent_name)
 WHERE child_name IS NOT NULL AND trim(child_name) !~ '\s' AND pg_temp.lastw(parent_name) IS NOT NULL;
UPDATE public.course_participants cp SET participant_name = trim(cp.participant_name)||' '||pg_temp.lastw(r.parent_name)
 FROM public.course_requests r WHERE r.id = cp.request_id AND trim(cp.participant_name) !~ '\s' AND pg_temp.lastw(r.parent_name) IS NOT NULL;
UPDATE public.course_participants cp SET participant_name = trim(cp.participant_name)||' '||m.last_name
 FROM public.memberships m WHERE trim(cp.participant_name) !~ '\s' AND cp.participant_email IS NOT NULL
 AND (lower(m.email)=lower(cp.participant_email) OR lower(coalesce(m.guardian_email,''))=lower(cp.participant_email)) AND trim(coalesce(m.last_name,''))<>'';
UPDATE public.course_participants cp SET participant_name = trim(cp.participant_name)||' '||p.last_name
 FROM public.profiles p WHERE trim(cp.participant_name) !~ '\s' AND lower(p.email)=lower(cp.participant_email) AND trim(coalesce(p.last_name,''))<>'';