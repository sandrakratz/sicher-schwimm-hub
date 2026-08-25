# Warteliste als eigener Menüpunkt im Adminbereich

## Ziel

Alle Anfragen mit Status „Warteliste" bekommen eine eigene Seite im Adminbereich, damit sie nicht mehr zwischen den übrigen Kursanfragen untergehen. Sortiert und gruppiert nach gewünschtem Kurs.

## Was entsteht

**Neuer Menüpunkt „Warteliste"** in der Admin-Seitenleiste (direkt unter „Kursanfragen"), sichtbar für Admin und Vorstand – wie bei den Kursanfragen.

**Neue Seite** mit:

- Gruppierung nach Wunschkurs in derselben Reihenfolge wie in den Kursanfragen: Schwimmen lernen, Seepferdchen-Vorbereitung, Seepferdchen, Bronze, Silber, Gold, Wassergewöhnung, Sonstiges – als aufklappbare Bereiche mit Anzahl-Badge.
- Innerhalb jeder Gruppe eine Tabelle, sortiert nach Eingangsdatum (älteste zuerst, damit die Reihenfolge der Warteliste stimmt), mit Spalten: Position, Datum, Eltern, Kind, Geburtsdatum, Wunschkurs, Sharky-Markierung, Notiz.
- Kopfzeile mit Gesamtzahl der Kinder auf der Warteliste.
- Klick auf eine Zeile öffnet denselben Detail-Dialog wie in den Kursanfragen (Details, Notizen bearbeiten, antworten, Kurs zuweisen, Status ändern, Sharky-Markierung).

**Welche Einträge erscheinen:** Anfragen mit Status „Warteliste", die noch keinem Kurs zugewiesen sind. Wer bereits einem Kurs zugewiesen wurde, bleibt wie bisher unter „Zugewiesene Anfragen" in den Kursanfragen.

Die bestehende Seite „Kursanfragen" bleibt unverändert – Wartelisten-Einträge sind dort weiterhin sichtbar, jetzt aber zusätzlich gebündelt an einer Stelle.

## Technische Umsetzung

- Gemeinsame Logik (Kategorien `COURSE_GROUPS`, `groupKeyFor`, `StatusBadge`, `SharkyButton`, Detail-Dialog) aus `src/routes/_authenticated/admin/anfragen.tsx` in ein gemeinsames Modul (`src/components/admin/course-requests/`) auslösen, damit beide Seiten dieselbe Darstellung und dasselbe Verhalten nutzen und keine Logik doppelt gepflegt wird.
- Neue Route `src/routes/_authenticated/admin/warteliste.tsx`, liest `course_requests` mit `status = 'waiting_list'` und `assigned_course_id is null`, aufsteigend nach `created_at`.
- Navigationseintrag in `src/routes/_authenticated/admin/route.tsx` ergänzen (Icon `Hourglass`, `allow: ["admin", "board"]`), inkl. Erweiterung des Route-Typs.
- Keine Datenbankänderung nötig – Status und Rollenprüfungen existieren bereits.
