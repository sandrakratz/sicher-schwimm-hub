-- Einmalige Bereinigung: Familien, die als Teilnehmer mit Status "waiting" geführt werden
-- (zweite Warteliste), kommen auf die normale Warteliste (waitlist_entries).
-- Sie erhalten erst Angebote für Kurse, die NACH dem aktuell letzten Kurs ihres Angebots starten
-- ("warten, bis ein neuer Kurs startet"). allocateWaitlist vergleicht dazu course.starts_on >= available_from.
--
-- Ablauf: im Supabase-SQL-Editor ZUERST Teil 1 (Vorschau) ausführen und prüfen, danach Teil 2.
-- Teil 2 läuft in einer Transaktion; am Ende COMMIT bewusst von Hand ausführen (oder ROLLBACK).
-- Voraussetzung: Migration 20261002130000_book_course_seat.sql und der zugehörige Code sind live,
-- damit keine neuen "waiting"-Teilnehmer mehr entstehen.

-- ===== Teil 1: Vorschau (nur lesen) =====
select p.id as participant_id, c.name as kurs, p.participant_name, p.participant_email,
       p.date_of_birth, p.is_member, p.created_at,
       (select max(c2.starts_on) + 1
          from courses c2
         where c2.archived_at is null
           and (c2.program_id = c.program_id or c2.id = c.id)) as angebote_ab_kursstart_nach,
       exists (select 1 from waitlist_entries w
                where w.status in ('waiting', 'offered')
                  and (w.request_id = p.request_id
                       or (lower(btrim(w.parent_email)) = lower(btrim(p.participant_email))
                           and lower(btrim(w.child_name)) = lower(btrim(p.participant_name))))) as steht_schon_auf_warteliste
  from course_participants p
  join courses c on c.id = p.course_id
 where p.status = 'waiting' and c.archived_at is null
 order by p.created_at;

-- ===== Teil 2: Übernehmen =====
begin;

insert into waitlist_entries (
  program_id, course_id, request_id, child_name, child_dob,
  parent_name, parent_email, parent_phone, is_member, notes, admin_notes,
  gdpr_consent, status, available_from, created_at
)
select c.program_id, c.id, p.request_id, p.participant_name, p.date_of_birth,
       coalesce(r.parent_name, p.participant_name), coalesce(r.parent_email, p.participant_email),
       coalesce(r.parent_phone, p.participant_phone), p.is_member, p.notes,
       'Übernommen von der Teilnehmer-Warteliste (' || c.name || ') am ' || to_char(now() at time zone 'Europe/Berlin', 'DD.MM.YYYY')
         || ' – wartet auf einen neuen Kurs.',
       true, 'waiting',
       (select max(c2.starts_on) + 1
          from courses c2
         where c2.archived_at is null
           and (c2.program_id = c.program_id or c2.id = c.id)),
       p.created_at
  from course_participants p
  join courses c on c.id = p.course_id
  left join course_requests r on r.id = p.request_id
 where p.status = 'waiting' and c.archived_at is null
   and not exists (select 1 from waitlist_entries w
                    where w.status in ('waiting', 'offered')
                      and (w.request_id = p.request_id
                           or (lower(btrim(w.parent_email)) = lower(btrim(p.participant_email))
                               and lower(btrim(w.child_name)) = lower(btrim(p.participant_name)))));

-- Anfrage zurücksetzen (wie "Zurück auf die Warteliste setzen" im Admin)
update course_requests set assigned_course_id = null, status = 'waiting_list'
 where id in (select request_id from course_participants p join courses c on c.id = p.course_id
               where p.status = 'waiting' and c.archived_at is null and p.request_id is not null);

-- Teilnehmer-Eintrag abschließen
update course_participants p
   set status = 'cancelled',
       internal_notes = concat_ws(E'\n', p.internal_notes, 'Auf die Warteliste übernommen am ' || to_char(now() at time zone 'Europe/Berlin', 'DD.MM.YYYY'))
  from courses c
 where c.id = p.course_id and p.status = 'waiting' and c.archived_at is null;

-- Ergebnis prüfen, dann:  commit;   (oder bei Auffälligkeiten:  rollback;)
select count(*) as neue_wartelisten_eintraege from waitlist_entries
 where admin_notes like 'Übernommen von der Teilnehmer-Warteliste%';
