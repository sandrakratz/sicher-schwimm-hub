## Sortierung der Kursanfragen nach Kursart

In `src/routes/_authenticated/admin/anfragen.tsx` wird die Tabelle der Kursanfragen aktuell nach Eingangsdatum (neueste zuerst) sortiert. Diese Sortierung wird auf den gewünschten Kurs (`desired_course`) umgestellt.

### Änderung
- Supabase-Abfrage in `load()` ändern: statt `.order("created_at", { ascending: false })` → `.order("desired_course", { ascending: true, nullsFirst: false })`, mit `created_at` als sekundärer Sortierung (neueste zuerst innerhalb derselben Kursart).
- Anfragen ohne Kurszuordnung (`desired_course = null`) erscheinen am Ende.

### Frage
Soll die Sortierung alphabetisch nach `desired_course` (so wie eingetragen) erfolgen, oder möchtest du eine andere Reihenfolge (z. B. nach zugewiesenem Kurs statt Wunschkurs)?
