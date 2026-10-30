-- Eine A/B-Test-Version ist unveränderlich: Schlüssel, Version, Varianten und Ziel dürfen nach dem Anlegen
-- nicht mehr geändert werden. Wer etwas ändern will, legt eine neue Version an (neue Zeile).
-- Erlaubt bleiben: Status, Beschreibung, Ende. Dadurch kann kein Ergebnis nachträglich anders gedeutet werden.

create or replace function public.analytics_experiments_guard()
returns trigger
language plpgsql
as $$
begin
  if new.key is distinct from old.key
     or new.version is distinct from old.version
     or new.variants is distinct from old.variants
     or new.goal_event is distinct from old.goal_event
     or new.goal_filter is distinct from old.goal_filter
     or new.started_at is distinct from old.started_at then
    raise exception 'A/B-Test % v% ist unveränderlich: bitte eine neue Version anlegen', old.key, old.version;
  end if;
  -- Beendete Tests bleiben beendet
  if old.status = 'stopped' and new.status is distinct from 'stopped' then
    raise exception 'A/B-Test % v% ist beendet und kann nicht erneut gestartet werden', old.key, old.version;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_analytics_experiments_guard on public.analytics_experiments;
create trigger trg_analytics_experiments_guard
  before update on public.analytics_experiments
  for each row execute function public.analytics_experiments_guard();
