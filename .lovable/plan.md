# Doppeltes Menü im Verwaltungsbereich entfernen

## Problem
Beim Öffnen eines Verwaltungspunkts erscheint das Menü zweimal nebeneinander: einmal die normale Portal-Seitenleiste, darin nochmal eine komplette Admin-Oberfläche mit eigener Seitenleiste, Kopfzeile und Abmelden-Button.

Ursache: Der Verwaltungsbereich hat eine eigene, vollständige Layout-Ansicht, die innerhalb des bereits vorhandenen Portal-Layouts gerendert wird. Seit der Menü-Zusammenlegung enthält die Portal-Seitenleiste ohnehin schon alle Verwaltungspunkte.

## Lösung
Den Verwaltungsbereich auf ein reines Durchreich-Layout reduzieren:

- Die Zugriffsprüfung (Anmeldung, Rollen, Weiterleitung von Trainern auf die Mitgliederliste) bleibt unverändert erhalten.
- Die doppelte Oberfläche (zweite Seitenleiste, mobile Kopfzeile, Logo, Abmelden-Button) entfällt; stattdessen wird nur noch der Seiteninhalt ausgegeben.
- Dadurch gilt für alle Verwaltungsseiten dieselbe Seitenleiste und derselbe Inhaltsbereich wie im übrigen Portal – auch auf dem Handy nur noch ein Menü.

## Technisch
- `src/routes/_authenticated/admin/route.tsx`: `beforeLoad` unverändert lassen, Komponente auf `<Outlet />` reduzieren; nicht mehr benötigte Imports (Sheet, Logo, Buttons, Icons, supabase, toast, nav-items) entfernen.
- Keine Änderungen an Datenbank, Rechten oder Seiteninhalten.
