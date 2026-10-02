-- Korrekturen der Kursdaten (Befunde der Prüfung vom 2026-10-02).
-- Vorgehen: im Supabase-SQL-Editor ZUERST Teil 1 (nur lesen) ausführen und mit der Webseite vergleichen,
-- danach die gewünschten Statements aus Teil 2 einzeln ausführen. Die Werte sind Vorschläge – bitte prüfen.
-- Teil 3 (Höchstalter) setzt voraus, dass die Migration 20261002140000_program_max_age.sql eingespielt ist.

-- ===== Teil 1: Ist-Zustand (nur lesen) =====
select slug, name, age_range, min_age_years, location, is_public, bookable
  from course_programs order by sort_order;

-- Pausen, die auf einen echten Kurstermin fallen (z. B. "Sonntag" am 03.01.2027 bei Wasserzeit)
select c.id, c.name, b.value as pause
  from courses c, jsonb_array_elements(coalesce(c.session_breaks, '[]'::jsonb)) b(value)
 where exists (select 1 from course_sessions s
                where s.course_id = c.id and s.session_date = (b.value->>'date')::date);

-- ===== Teil 2: Korrekturen =====

-- a) Schwimmstarter: Adresse /kurse/s -> /kurse/schwimmstarter
--    (die alte Adresse leitet der Code automatisch weiter, damit Links aus E-Mails weiter funktionieren)
update course_programs set slug = 'schwimmstarter'
 where slug = 's' and not exists (select 1 from course_programs where slug = 'schwimmstarter');

-- b) Gold: Altersangabe steht nur als "10" (Silber: "ab 9 Jahre", Bronze: "ab 7 Jahre") – bitte prüfen!
update course_programs set age_range = 'ab 10 Jahre' where slug = 'gold' and age_range = '10';

-- c) Bronze: Hinweistext im Ortsfeld (landet auch in Bestätigungsmails); die Termine stehen inzwischen fest
update course_programs set location = 'Sportschule Hennef'
 where slug = 'bronze' and location like 'Sportschule Hennef%Kurse folgen%';

-- d) Doppelte Pausen entfernen (Pause am Tag eines echten Termins)
update courses c
   set session_breaks = (
     select coalesce(jsonb_agg(b.value), '[]'::jsonb)
       from jsonb_array_elements(c.session_breaks) b(value)
      where not exists (select 1 from course_sessions s
                         where s.course_id = c.id and s.session_date = (b.value->>'date')::date))
 where c.session_breaks is not null and jsonb_array_length(c.session_breaks) > 0
   and exists (select 1 from jsonb_array_elements(c.session_breaks) b(value)
                where exists (select 1 from course_sessions s
                               where s.course_id = c.id and s.session_date = (b.value->>'date')::date));

-- ===== Teil 3: Höchstalter (optional, nur wenn gewünscht – sonst im Admin beim Angebot eintragen) =====
-- Auf der Webseite steht "max. 5 Jahre" (Wasserzeit Kinder & Eltern) bzw. "5–8 Jahre" (Seepferdchen) bzw. "4-6 Jahre" (Schwimmstarter).
-- update course_programs set max_age_years = 5 where slug = 'wasserzeit-kinder-eltern';
-- update course_programs set max_age_years = 8 where slug = 'seepferdchen';
-- update course_programs set max_age_years = 6 where slug = 'schwimmstarter';
