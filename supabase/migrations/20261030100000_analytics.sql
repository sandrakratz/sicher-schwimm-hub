-- Nutzungsmessung (nur mit Einwilligung) und serverseitige Gegenmessung.
--
-- * analytics_events      Rohereignisse. Schreiben nur über den Server (service_role), Lesen nur Verwaltung.
--                         Keine IP-Adressen, keine Formularinhalte. visitor_id ist eine zufällige ID aus dem
--                         Browser (nur nach Einwilligung) und mit keinem Konto verknüpft.
-- * analytics_experiments A/B-Tests. Eine Version ist unveränderlich, Änderungen = neue Version.
-- * analytics_daily       Tagesaggregate, bleiben nach dem Löschen der Rohdaten erhalten.
--
-- Aufbewahrung: Rohdaten 90 Tage (täglicher Job 02:45 UTC, danach Aggregate).
-- Vorab testen:  select public.run_analytics_rollup(true);

create table if not exists public.analytics_events (
  id              bigint generated always as identity primary key,
  created_at      timestamptz not null default now(),
  occurred_at     timestamptz not null default now(),
  source          text not null check (source in ('client', 'server')),
  event           text not null check (char_length(event) between 1 and 60),
  schema_version  smallint not null check (schema_version >= 1),
  app_build       text,
  consent_version smallint,
  visitor_id      uuid,
  session_id      uuid,
  path            text check (path is null or char_length(path) <= 200),
  referrer_host   text check (referrer_host is null or char_length(referrer_host) <= 120),
  device_class    text check (device_class is null or device_class in ('mobile', 'tablet', 'desktop')),
  experiment_key  text,
  experiment_version smallint,
  variant         text,
  props           jsonb not null default '{}'::jsonb
);

create index if not exists analytics_events_created_idx on public.analytics_events (created_at);
create index if not exists analytics_events_event_idx on public.analytics_events (event, created_at);
create index if not exists analytics_events_exp_idx
  on public.analytics_events (experiment_key, experiment_version, variant)
  where experiment_key is not null;

create table if not exists public.analytics_experiments (
  id            bigint generated always as identity primary key,
  key           text not null check (key ~ '^[a-z0-9_]{2,60}$'),
  version       smallint not null default 1 check (version >= 1),
  description   text,
  variants      jsonb not null,           -- z. B. {"control": 50, "kurz": 50}
  goal_event    text not null,            -- Ereignis, das als Erfolg zählt
  status        text not null default 'draft' check (status in ('draft', 'running', 'stopped')),
  started_at    timestamptz,
  ended_at      timestamptz,
  created_at    timestamptz not null default now(),
  unique (key, version)
);

create table if not exists public.analytics_daily (
  day             date not null,
  source          text not null,
  event           text not null,
  schema_version  smallint not null,
  path            text not null default '',
  experiment_key  text not null default '',
  experiment_version smallint not null default 0,
  variant         text not null default '',
  events          integer not null,
  visitors        integer not null,
  primary key (day, source, event, schema_version, path, experiment_key, experiment_version, variant)
);

-- Rechte: nichts für anon/authenticated außer Lesen durch Verwaltung
alter table public.analytics_events enable row level security;
alter table public.analytics_experiments enable row level security;
alter table public.analytics_daily enable row level security;

revoke all on public.analytics_events from public, anon, authenticated;
revoke all on public.analytics_experiments from public, anon, authenticated;
revoke all on public.analytics_daily from public, anon, authenticated;
grant select on public.analytics_events to authenticated;
grant select on public.analytics_experiments to authenticated;
grant select on public.analytics_daily to authenticated;
grant all on public.analytics_events to service_role;
grant all on public.analytics_experiments to service_role;
grant all on public.analytics_daily to service_role;

drop policy if exists "Staff read analytics events" on public.analytics_events;
create policy "Staff read analytics events" on public.analytics_events
  for select to authenticated using (public.is_staff(auth.uid()));
drop policy if exists "Staff read analytics experiments" on public.analytics_experiments;
create policy "Staff read analytics experiments" on public.analytics_experiments
  for select to authenticated using (public.is_staff(auth.uid()));
drop policy if exists "Staff read analytics daily" on public.analytics_daily;
create policy "Staff read analytics daily" on public.analytics_daily
  for select to authenticated using (public.is_staff(auth.uid()));

-- Rollup + Löschen der Rohdaten nach 90 Tagen. Aggregiert vor dem Löschen alle Tage, die noch fehlen.
create or replace function public.run_analytics_rollup(p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - interval '90 days';
  n_rolled int := 0;
  n_deleted int := 0;
begin
  if p_dry_run then
    select count(*) into n_deleted from public.analytics_events where created_at < cutoff;
    return jsonb_build_object('dry_run', true, 'would_delete', n_deleted);
  end if;

  insert into public.analytics_daily
    (day, source, event, schema_version, path, experiment_key, experiment_version, variant, events, visitors)
  select (created_at at time zone 'Europe/Berlin')::date,
         source, event, schema_version,
         coalesce(path, ''), coalesce(experiment_key, ''), coalesce(experiment_version, 0), coalesce(variant, ''),
         count(*)::int, count(distinct visitor_id)::int
    from public.analytics_events
   where created_at < cutoff
   group by 1, 2, 3, 4, 5, 6, 7, 8
  on conflict (day, source, event, schema_version, path, experiment_key, experiment_version, variant)
  do update set events = excluded.events, visitors = excluded.visitors;
  get diagnostics n_rolled = row_count;

  delete from public.analytics_events where created_at < cutoff;
  get diagnostics n_deleted = row_count;

  return jsonb_build_object('rolled_up', n_rolled, 'deleted', n_deleted);
end;
$$;

revoke all on function public.run_analytics_rollup(boolean) from public, anon, authenticated;
grant execute on function public.run_analytics_rollup(boolean) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('analytics-rollup-daily')
      where exists (select 1 from cron.job where jobname = 'analytics-rollup-daily');
    perform cron.schedule('analytics-rollup-daily', '45 2 * * *', 'select public.run_analytics_rollup()');
  else
    raise notice 'pg_cron fehlt: Rollup-Job nicht eingerichtet. Erweiterung einschalten und diese Migration erneut ausführen.';
  end if;
end $$;
