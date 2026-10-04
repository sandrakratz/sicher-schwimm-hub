-- Löschfrist für den Gurt-Stand (course_participants.belt_blocks), wie in der Datenschutzerklärung (Ziffer 4):
-- 3 Jahre nach Ablauf des Kursjahres, gleiche Regel wie für die Teilnehmer-Notizen. Der Datensatz der Buchung bleibt.
-- Ersetzt run_retention_cleanup aus 20261001120000_retention_cleanup.sql; Cron-Job und Rechte bleiben unverändert.
--
-- Vorab testen, ohne etwas zu ändern:  select public.run_retention_cleanup(true);

create or replace function public.run_retention_cleanup(p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Letztes Anlassjahr, dessen Frist (Ende des Jahres + 3 Jahre) bereits abgelaufen ist.
  y int := extract(year from current_date)::int - 4;
  n_mail int := 0;
  n_cancel int := 0;
  n_requests int := 0;
  n_participants int := 0;
  n_waitlist int := 0;
  result jsonb;
begin
  begin
    delete from public.email_send_log
     where extract(year from created_at) <= y;
    get diagnostics n_mail = row_count;

    delete from public.cancellation_requests
     where extract(year from created_at) <= y;
    get diagnostics n_cancel = row_count;

    update public.course_requests r
       set health_info = null
     where r.health_info is not null
       and extract(year from coalesce(
             (select c.ends_on from public.courses c where c.id = r.assigned_course_id),
             r.created_at::date)) <= y;
    get diagnostics n_requests = row_count;

    update public.course_participants p
       set notes = null,
           belt_blocks = null
      from public.courses c
     where c.id = p.course_id
       and (p.notes is not null or p.belt_blocks is not null)
       and c.ends_on is not null
       and extract(year from c.ends_on) <= y;
    get diagnostics n_participants = row_count;

    update public.waitlist_entries
       set notes = null
     where notes is not null
       and extract(year from created_at) <= y;
    get diagnostics n_waitlist = row_count;

    if p_dry_run then
      raise exception 'Probelauf, nichts wird gespeichert' using errcode = 'DRY01';
    end if;
  exception when sqlstate 'DRY01' then
    null; -- Änderungen dieses Blocks werden zurückgenommen, die Zähler bleiben erhalten
  end;

  result := jsonb_build_object(
    'dry_run', p_dry_run,
    'stichtag_jahr', y,
    'email_send_log_geloescht', n_mail,
    'widerrufe_geloescht', n_cancel,
    'anfragen_gesundheitsangaben_geleert', n_requests,
    'teilnehmer_notizen_und_gurt_geleert', n_participants,
    'warteliste_notizen_geleert', n_waitlist
  );

  if not p_dry_run and (n_mail + n_cancel + n_requests + n_participants + n_waitlist) > 0 then
    insert into public.audit_logs (actor_id, action, entity, metadata)
    values (null, 'retention_cleanup', 'system', result);
  end if;

  return result;
end;
$$;

revoke all on function public.run_retention_cleanup(boolean) from public, anon, authenticated;
grant execute on function public.run_retention_cleanup(boolean) to service_role;
