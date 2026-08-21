# Notizen bei Kursanfragen

Interne Notizen (z. B. „am 20.08. telefoniert") sollen in der Detailansicht einer Kursanfrage erfasst und in der Übersichtstabelle sichtbar sein.

## Was gebaut wird

1. **Detailansicht**: Neuer Bereich „Interne Notizen" mit mehrzeiligem Textfeld und Button „Notiz speichern". Bestehende Notizen werden beim Öffnen geladen; nach dem Speichern kurze Bestätigung und die Liste aktualisiert sich.
2. **Übersichtstabelle**: Neue Spalte „Notiz" zwischen Status und den Aktionen. Zeigt eine gekürzte Vorschau (eine Zeile, ca. 40 Zeichen) mit vollem Text als Tooltip; leer, wenn keine Notiz vorhanden.
3. Gilt für alle Reiter (Aktive Anfragen, Zugewiesene Anfragen, Abgelehnt).

## Technisch

- Das Feld `admin_notes` in `course_requests` existiert bereits – keine Datenbankänderung nötig. Die vorhandenen Rechte für Admin/Vorstand reichen aus.
- Änderungen nur in `src/routes/_authenticated/admin/anfragen.tsx`: lokaler State für den Notiztext, Speichern per Update auf `course_requests.admin_notes`, neue Tabellenspalte in der bestehenden Tabellen-Komponente.
- Hinweis: Bei einer Kurszuweisung wird `admin_notes` bereits verwendet (Zuweisungshinweise) – die Notiz bleibt dasselbe Feld, damit alles an einer Stelle steht.
