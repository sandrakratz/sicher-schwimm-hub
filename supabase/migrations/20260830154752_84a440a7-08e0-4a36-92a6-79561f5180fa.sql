ALTER TABLE public.course_programs ADD COLUMN IF NOT EXISTS bookable boolean NOT NULL DEFAULT true;

UPDATE public.course_programs SET is_public = false WHERE slug IN ('wassergewoehnung','eltern-kind','anfaenger-schwimmen');

INSERT INTO public.course_programs (name, slug, target_group, age_range, min_age_years, description, requirements, duration, location, price_member, price_non_member, payment_due_days, is_public, bookable, sort_order)
VALUES
('Wasserzeit für Babys & Kleinkinder','wasserzeit-babys-kleinkinder','Familien / Eltern & Kind','3 Monate – 3 Jahre',NULL,
 'Wasser darf von Anfang an etwas Schönes sein.

In unserer Wasserzeit für Babys und Kleinkinder begleiten wir Familien dabei, gemeinsam positive Erfahrungen mit dem Wasser zu sammeln. Im Mittelpunkt stehen nicht Leistung oder frühes Schwimmenlernen, sondern Vertrauen, Sicherheit, Bewegung und Freude am Wasser.

Ein Elternteil ist gemeinsam mit dem Kind im Wasser. Unsere Trainerinnen begleiten die Familien aktiv im Wasser, beobachten das einzelne Kind und geben individuelle Anregungen. Dabei darf jedes Kind sein eigenes Tempo bestimmen.

Wir möchten Eltern zeigen, wie sie ihr Kind sicher und vertrauensvoll an das Wasser heranführen können – vom ersten Planschen über das Bewegen und Schweben bis hin zu ersten Erfahrungen mit Wasser im Gesicht.

Die Wasserzeit ist bewusst kein klassischer Schwimmkurs. Sie schafft vielmehr eine gute Grundlage für einen sicheren und positiven Umgang mit dem Wasser.',
 '8 Termine
ca. 40 Minuten aktive Wasserzeit
1 Elternteil + 1 Kind
mindestens 7, maximal 8 Familien
angeleitete Wasserzeit mit den Trainerinnen im Wasser',
 '8 Termine · ca. 40 Minuten · geplant ab Ende 2026','Kurbad Hennef',210,240,14,true,false,5),
('Wasserzeit für Kinder & Eltern','wasserzeit-kinder-eltern','Familien / Eltern & Kind','3 – 5 Jahre',NULL,
 'Mit Freude, Vertrauen und ganz viel Zeit zum Ausprobieren.

In unserer Wasserzeit für Kinder von 3 bis 5 Jahren entdecken Kinder gemeinsam mit einem Elternteil die Möglichkeiten des Wassers. Die Trainerinnen begleiten die Familien aktiv im Wasser und gehen individuell auf die Bedürfnisse und den Entwicklungsstand jedes Kindes ein.

Wir möchten Kinder nicht möglichst schnell zu Schwimmern machen. Viel wichtiger ist uns, dass sie sich im Wasser sicher fühlen, Vertrauen entwickeln und ihre eigenen Fähigkeiten entdecken.

Gemeinsam werden spielerisch verschiedene Erfahrungen gesammelt: Wasser im Gesicht, Pusten und Blubbern, Schweben, Gleiten, Tauchen, Bewegen und erste Sprungerfahrungen – immer ohne Druck und immer entsprechend dem eigenen Tempo des Kindes.

Das Elternteil bleibt dabei die wichtigste Bezugsperson. Unsere Trainerinnen geben Impulse, zeigen Möglichkeiten und begleiten die Familie auf ihrem individuellen Weg.

Auch dieses Angebot ist bewusst keine klassische Schwimmausbildung. Es geht zunächst darum, Sicherheit, Wasserkompetenz, Selbstvertrauen und Freude am Wasser zu entwickeln.',
 '8 Termine
ca. 40 Minuten aktive Wasserzeit
1 Elternteil + 1 Kind
mindestens 7, maximal 8 Familien
angeleitete Wasserzeit mit den Trainerinnen im Wasser',
 '8 Termine · ca. 40 Minuten · geplant ab Ende 2026','Kurbad Hennef',210,240,14,true,false,6)
ON CONFLICT (slug) DO NOTHING;