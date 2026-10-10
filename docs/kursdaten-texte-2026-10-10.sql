-- Textkorrekturen auf der Kursseite (Befunde der Seitenprüfung vom 2026-10-10).
-- Im Supabase-SQL-Editor zuerst Teil 1 (nur lesen) ausführen, die Texte lesen, dann Teil 2 einzeln einspielen.
-- Die Texte sind Vorschläge – bitte nach eurem Geschmack ändern.

-- ===== Teil 1: Ist-Zustand =====
select slug, name, target_group, duration, left(description, 80) as beschreibung
  from course_programs
 where slug in ('silber', 'gold', 'schwimmstarter', 'schwimmabzeichen-aufbaukurs');

-- ===== Teil 2: Korrekturen =====

-- a) Silber und Gold haben denselben Text ("Erweiterte Technik und Ausdauer.")
update course_programs set description =
  'Für Kinder mit Bronze-Abzeichen: längere Strecken, saubere Technik und mehr Ausdauer. Am Ende steht die Abnahme des Silber-Abzeichens nach der Deutschen Prüfungsordnung Schwimmen.'
 where slug = 'silber';

update course_programs set description =
  'Der letzte Schritt bei den Kinderabzeichen: noch mehr Ausdauer, sichere Technik und Selbstvertrauen im Wasser. Am Ende steht die Abnahme des Gold-Abzeichens nach der Deutschen Prüfungsordnung Schwimmen.'
 where slug = 'gold';

-- b) Schwimmstarter: Dauer steht nur als "8" (die Seite zeigt das jetzt als "8 Wochen";
--    stimmt es, ist nichts zu tun – sind es 8 Termine, bitte hier "8 Termine" eintragen)
-- update course_programs set duration = '8 Termine' where slug = 'schwimmstarter';

-- c) Aufbaukurs: im Feld "Zielgruppe" steht ein ganzer Satz, auf der Karte erscheint er als Etikett
update course_programs set target_group = 'Kinder/Jugend'
 where slug = 'schwimmabzeichen-aufbaukurs' and target_group ilike 'motivierte Kinder%';
