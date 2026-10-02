-- Atomare Platzbuchung: Prüfen (Duplikat, Kapazität, Angebot) und Einfügen laufen in EINER
-- Transaktion; die Kurszeile wird gesperrt, damit gleichzeitige Buchungen nacheinander laufen.
-- Aufruf nur serverseitig (service_role) aus bookCourseTerm / bookWaitlistEntry.
--
-- p_source = 'parent': Kapazität wird geprüft, ein Wartelisten-Angebot muss gültig sein.
-- p_source = 'admin' : Vorstand darf über die Kapazität hinaus buchen (nur Duplikate werden blockiert).
-- Ergebnis (jsonb): result = booked | full | duplicate | offer_not_valid | course_not_found

create or replace function public.book_course_seat(
  p_course_id uuid,
  p_participant jsonb,
  p_entry_id uuid default null,
  p_source text default 'parent'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course public.courses%rowtype;
  v_entry public.waitlist_entries%rowtype;
  v_taken int;
  v_dup uuid;
  v_id uuid;
  v_doc text;
begin
  -- 1) Kurs sperren: ab hier laufen Buchungen für diesen Kurs nacheinander
  select * into v_course from public.courses where id = p_course_id for update;
  if not found then
    return jsonb_build_object('result', 'course_not_found');
  end if;

  -- 2) Wartelisten-Angebot prüfen (Zusage) bzw. Eintrag für die Direktbuchung sperren
  if p_entry_id is not null then
    select * into v_entry from public.waitlist_entries where id = p_entry_id for update;
    if not found
       or (p_source = 'parent' and (v_entry.status <> 'offered' or v_entry.offer_expires_at < now()))
       or (p_source <> 'parent' and v_entry.status = 'accepted') then
      return jsonb_build_object('result', 'offer_not_valid');
    end if;
  end if;

  -- 3) Duplikat: dasselbe Kind (Name + Geburtsdatum) ist im Kurs bereits aktiv eingetragen
  select id into v_dup
    from public.course_participants
   where course_id = p_course_id
     and status <> 'cancelled'
     and date_of_birth is not null
     and date_of_birth = (p_participant->>'date_of_birth')::date
     and lower(btrim(participant_name)) = lower(btrim(p_participant->>'participant_name'))
   limit 1;
  if v_dup is not null then
    return jsonb_build_object('result', 'duplicate', 'participant_id', v_dup);
  end if;

  -- 4) Kapazität: bestätigte Teilnehmer + laufende Angebote (außer dem eigenen)
  if p_source = 'parent' and v_course.max_participants is not null then
    select (select count(*) from public.course_participants
             where course_id = p_course_id and status = 'confirmed')
         + (select count(*) from public.waitlist_entries
             where offer_course_id = p_course_id and status = 'offered'
               and offer_expires_at >= now()
               and (p_entry_id is null or id <> p_entry_id))
      into v_taken;
    if v_taken >= v_course.max_participants then
      return jsonb_build_object('result', 'full');
    end if;
  end if;

  -- 5) Buchen (Belegnummer erst jetzt, damit bei Ablehnung keine Nummer verbraucht wird)
  v_doc := public.generate_course_document_no();
  insert into public.course_participants (
    course_id, status, participant_name, participant_email, participant_phone,
    payer_street, payer_zip, payer_city, date_of_birth, notes, is_member, price_amount,
    online_booking, paid, payment_method, payment_due_date, push_token,
    document_no, document_issued_at
  ) values (
    p_course_id, 'confirmed',
    p_participant->>'participant_name', p_participant->>'participant_email', p_participant->>'participant_phone',
    p_participant->>'payer_street', p_participant->>'payer_zip', p_participant->>'payer_city',
    (p_participant->>'date_of_birth')::date, p_participant->>'notes',
    (p_participant->>'is_member')::boolean, (p_participant->>'price_amount')::numeric,
    coalesce((p_participant->>'online_booking')::boolean, false), false,
    p_participant->>'payment_method', (p_participant->>'payment_due_date')::date,
    p_participant->>'push_token',
    v_doc, coalesce((p_participant->>'document_issued_at')::timestamptz, now())
  ) returning id into v_id;

  -- 6) Wartelisten-Angebot im selben Schritt einlösen
  if p_entry_id is not null then
    update public.waitlist_entries
       set status = 'accepted', offer_token = null, offer_course_id = p_course_id, responded_at = now()
     where id = p_entry_id;
  end if;

  return jsonb_build_object('result', 'booked', 'participant_id', v_id, 'document_no', v_doc);
end;
$$;

revoke all on function public.book_course_seat(uuid, jsonb, uuid, text) from public;
grant execute on function public.book_course_seat(uuid, jsonb, uuid, text) to service_role;
