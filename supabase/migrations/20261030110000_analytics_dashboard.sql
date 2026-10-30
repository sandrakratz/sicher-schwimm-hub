-- Auswertung für /admin/statistik. Nur über den Server (service_role) aufrufbar, dort wird die Rolle geprüft.
--
-- Versionierung: Es zählen nur Ereignisse in der Schema-Version, die der Code gerade erwartet
-- (p_versions, z. B. {"page_view":1,"page_leave":1,...}). Ältere Versionen werden separat aufgelistet,
-- aber nie in Kennzahlen eingerechnet.
-- Experimente werden pro (Schlüssel, Version) und nur in ihrer Laufzeit ausgewertet.

alter table public.analytics_experiments
  add column if not exists goal_filter jsonb not null default '{}'::jsonb;

create or replace function public.analytics_dashboard(
  p_from timestamptz,
  p_to timestamptz,
  p_versions jsonb
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with ev as (
  select e.*
    from public.analytics_events e
   where e.created_at >= p_from and e.created_at < p_to
     and e.schema_version = (p_versions ->> e.event)::int
),
views as (select * from ev where event = 'page_view'),
leaves as (
  select path,
         (props ->> 'visible_ms')::numeric as visible_ms,
         (props ->> 'max_scroll_pct')::numeric as scroll
    from ev
   where event = 'page_leave' and (props ->> 'visible_ms')::numeric > 0
),
overview as (
  select jsonb_build_object(
    'page_views', (select count(*) from views),
    'visitors', (select count(distinct visitor_id) from views),
    'sessions', (select count(distinct session_id) from views),
    'median_visible_s',
      (select round((percentile_cont(0.5) within group (order by visible_ms) / 1000)::numeric, 1) from leaves),
    'avg_scroll_pct', (select round(avg(scroll)) from leaves)
  ) as j
),
daily as (
  select coalesce(jsonb_agg(jsonb_build_object('day', d, 'views', v, 'visitors', u) order by d), '[]'::jsonb) as j
    from (
      select (created_at at time zone 'Europe/Berlin')::date as d,
             count(*) as v, count(distinct visitor_id) as u
        from views group by 1
    ) x
),
pages as (
  select coalesce(jsonb_agg(row_to_json(x) order by x.views desc), '[]'::jsonb) as j
    from (
      select v.path,
             count(*) as views,
             count(distinct v.visitor_id) as visitors,
             (select round((percentile_cont(0.5) within group (order by l.visible_ms) / 1000)::numeric, 1)
                from leaves l where l.path = v.path) as median_visible_s,
             (select round(avg(l.scroll)) from leaves l where l.path = v.path) as avg_scroll_pct
        from views v
       group by v.path
       order by count(*) desc
       limit 30
    ) x
),
referrers as (
  select coalesce(jsonb_agg(row_to_json(x) order by x.sessions desc), '[]'::jsonb) as j
    from (
      select referrer_host as host, count(distinct session_id) as sessions
        from views
       where referrer_host is not null
       group by 1 order by 2 desc limit 10
    ) x
),
devices as (
  select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) as j
    from (
      select device_class as device, count(distinct visitor_id) as visitors
        from views where device_class is not null group by 1 order by 2 desc
    ) x
),
form_names as (
  select distinct props ->> 'form' as form from ev where props ? 'form'
),
forms as (
  select coalesce(jsonb_agg(row_to_json(x) order by x.started desc nulls last), '[]'::jsonb) as j
    from (
      select f.form,
        (select count(distinct session_id) from ev where event = 'form_start' and props ->> 'form' = f.form) as started,
        (select count(*) from ev where event = 'form_submit_attempt' and props ->> 'form' = f.form) as attempts,
        (select count(*) from ev where event = 'form_submit_attempt' and props ->> 'form' = f.form
            and props ->> 'valid' = 'false') as invalid_attempts,
        (select count(*) from ev where event = 'form_submit_error' and props ->> 'form' = f.form) as client_errors,
        (select count(*) from ev where event = 'form_submit_success' and props ->> 'form' = f.form) as client_success,
        (select count(distinct session_id) from ev where event = 'form_abandon' and props ->> 'form' = f.form) as abandoned,
        (select count(*) from ev where event = 'form_received' and props ->> 'form' = f.form) as server_received,
        (select count(*) from ev where event = 'form_rejected' and props ->> 'form' = f.form) as server_rejected
      from form_names f
    ) x
),
field_errors as (
  select coalesce(jsonb_agg(row_to_json(x) order by x.errors desc), '[]'::jsonb) as j
    from (
      select props ->> 'form' as form, props ->> 'field' as field, props ->> 'code' as code, count(*) as errors
        from ev where event = 'form_field_error'
       group by 1, 2, 3 order by 4 desc limit 40
    ) x
),
rejections as (
  select coalesce(jsonb_agg(row_to_json(x) order by x.n desc), '[]'::jsonb) as j
    from (
      select props ->> 'form' as form, props ->> 'reason' as reason, count(*) as n
        from ev where event = 'form_rejected' group by 1, 2 order by 3 desc limit 40
    ) x
),
abandon_fields as (
  select coalesce(jsonb_agg(row_to_json(x) order by x.n desc), '[]'::jsonb) as j
    from (
      select props ->> 'form' as form, coalesce(props ->> 'last_field', '(kein Feld)') as last_field, count(*) as n
        from ev where event = 'form_abandon' group by 1, 2 order by 3 desc limit 30
    ) x
),
cta as (
  select coalesce(jsonb_agg(row_to_json(x) order by x.clicks desc), '[]'::jsonb) as j
    from (
      select props ->> 'cta' as cta, count(*) as clicks, count(distinct visitor_id) as visitors
        from ev where event = 'cta_click' group by 1 order by 2 desc limit 20
    ) x
),
db_counts as (
  select jsonb_build_object(
    'kontakt', (select count(*) from public.messages where from_user_id is null and created_at >= p_from and created_at < p_to),
    'mitgliedschaft', (select count(*) from public.memberships where created_at >= p_from and created_at < p_to)
  ) as j
),
versions as (
  select coalesce(jsonb_agg(row_to_json(x) order by x.event, x.schema_version), '[]'::jsonb) as j
    from (
      select event, source, schema_version, count(*) as events,
             min(created_at) as first_seen, max(created_at) as last_seen
        from public.analytics_events
       where created_at >= p_from and created_at < p_to
       group by 1, 2, 3
    ) x
),
exp_rows as (
  select e.id, e.key, e.version, e.description, e.status, e.goal_event, e.goal_filter,
         e.started_at, e.ended_at, e.variants
    from public.analytics_experiments e
   where e.status <> 'draft'
),
exposures as (
  -- erste Sichtung je Besucher, Experiment, Version und Variante (nur in der Laufzeit)
  select r.id as exp_id, a.variant, a.visitor_id, min(a.created_at) as first_at
    from exp_rows r
    join public.analytics_events a
      on a.experiment_key = r.key and a.experiment_version = r.version
     and a.event = 'experiment_exposure'
     and a.schema_version = (p_versions ->> 'experiment_exposure')::int
     and a.visitor_id is not null
     and a.created_at >= coalesce(r.started_at, '-infinity')
     and a.created_at < coalesce(r.ended_at, 'infinity')
   group by r.id, a.variant, a.visitor_id
),
experiments as (
  select coalesce(jsonb_agg(jsonb_build_object(
      'key', r.key, 'version', r.version, 'description', r.description, 'status', r.status,
      'goal_event', r.goal_event, 'goal_filter', r.goal_filter,
      'started_at', r.started_at, 'ended_at', r.ended_at, 'variants', r.variants,
      'results', (
        select coalesce(jsonb_agg(jsonb_build_object(
            'variant', s.variant, 'visitors', s.visitors, 'conversions', s.conversions
          ) order by s.variant), '[]'::jsonb)
          from (
            select x.variant,
                   count(*) as visitors,
                   count(*) filter (where exists (
                     select 1 from public.analytics_events g
                      where g.visitor_id = x.visitor_id
                        and g.event = r.goal_event
                        and g.schema_version = (p_versions ->> r.goal_event)::int
                        and g.props @> r.goal_filter
                        and g.created_at >= x.first_at
                        and g.created_at < coalesce(r.ended_at, 'infinity')
                   )) as conversions
              from exposures x where x.exp_id = r.id
             group by x.variant
          ) s
      )
    ) order by r.started_at desc nulls last), '[]'::jsonb) as j
    from exp_rows r
)
select jsonb_build_object(
  'overview', (select j from overview),
  'daily', (select j from daily),
  'pages', (select j from pages),
  'referrers', (select j from referrers),
  'devices', (select j from devices),
  'forms', (select j from forms),
  'field_errors', (select j from field_errors),
  'rejections', (select j from rejections),
  'abandon_fields', (select j from abandon_fields),
  'cta', (select j from cta),
  'db_counts', (select j from db_counts),
  'versions', (select j from versions),
  'experiments', (select j from experiments)
);
$$;

revoke all on function public.analytics_dashboard(timestamptz, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.analytics_dashboard(timestamptz, timestamptz, jsonb) to service_role;
