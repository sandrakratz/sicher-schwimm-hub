-- Jonathan Elia (Eltern: Silke Nickeleit): Anmerkungen aus der Warteliste lagen in course_requests.health_info,
-- sind aber keine Gesundheitsangabe. Sie werden nach message verschoben, health_info wird geleert.
-- Nur diese Anfrage wird angefasst. Erst Schritt 1 ausführen und prüfen, dann Schritt 2.

-- Schritt 1: Vorschau (genau 1 Zeile erwartet)
select id, child_name, parent_email, status, message, health_info, admin_notes, created_at
from public.course_requests
where parent_email = 'impulse.dasehecafe@googlemail.com'
  and child_name ilike '%Jonathan%'
  and health_info is not null
  and btrim(health_info) <> '';

-- Schritt 2: Umkopieren (message bleibt erhalten, falls schon etwas drinsteht)
update public.course_requests
set message = case
      when message is null or btrim(message) = '' then health_info
      else message || E'\n' || health_info
    end,
    health_info = null
where parent_email = 'impulse.dasehecafe@googlemail.com'
  and child_name ilike '%Jonathan%'
  and health_info is not null
  and btrim(health_info) <> '';

-- Schritt 3: Kontrolle
select id, child_name, message, health_info
from public.course_requests
where parent_email = 'impulse.dasehecafe@googlemail.com'
  and child_name ilike '%Jonathan%';
