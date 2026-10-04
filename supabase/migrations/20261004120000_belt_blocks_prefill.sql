-- Gurt-Stand bei jeder neuen Buchung automatisch vorbelegen.
-- Hat ein Kind (Name + Geburtsdatum, wie bei der Dubletten-Prüfung) in einem früheren Kurs einen Gurt-Stand,
-- übernimmt die neue Buchung den jüngsten davon. Gilt für alle Buchungswege (Online, Warteliste, Admin),
-- weil es als Trigger läuft. Wurde beim Anlegen schon ein Wert gesetzt (z. B. bei der Umbuchung), bleibt er.
-- Der Trainer kann den Wert jederzeit ändern. Die neue Buchung hat ihre eigene Löschfrist
-- (siehe 20261004110000_retention_belt_blocks.sql), der Stand wandert so von Kurs zu Kurs weiter.

create or replace function public.prefill_belt_blocks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.belt_blocks is null
     and new.date_of_birth is not null
     and nullif(btrim(new.participant_name), '') is not null then
    select p.belt_blocks
      into new.belt_blocks
      from public.course_participants p
      join public.courses c on c.id = p.course_id
      left join public.courses nc on nc.id = new.course_id
     where p.belt_blocks is not null
       and p.date_of_birth = new.date_of_birth
       and lower(btrim(p.participant_name)) = lower(btrim(new.participant_name))
       and p.course_id is distinct from new.course_id
       -- nur frühere Kurse: einer, der erst nach dem neuen beginnt, zählt nicht
       and (nc.starts_on is null or c.starts_on is null or c.starts_on <= nc.starts_on)
     order by coalesce(c.ends_on, c.starts_on, p.created_at::date) desc, p.created_at desc
     limit 1;
  end if;
  return new;
end;
$$;

revoke all on function public.prefill_belt_blocks() from public, anon, authenticated;

drop trigger if exists course_participants_prefill_belt_blocks on public.course_participants;
create trigger course_participants_prefill_belt_blocks
  before insert on public.course_participants
  for each row execute function public.prefill_belt_blocks();
