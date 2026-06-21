## Excel-Kursliste – Plan

### 1. Datenbank: neue Tabelle `course_sessions`
- Felder: `id`, `course_id` (FK → courses, cascade delete), `session_date` (date), `session_index` (int, 1–10), `note` (text, optional), `created_at`, `updated_at`.
- Unique: `(course_id, session_index)`.
- RLS: SELECT für `authenticated`, vollständige Verwaltung nur für `admin`/`board`/`trainer` via `has_role`. GRANTs entsprechend.
- Update-Trigger für `updated_at`.

### 2. Admin-UI – Termin-Verwaltung im Kurs-Dialog (`src/routes/_authenticated/admin/kurse.tsx`)
- Neuer Abschnitt „Kurstermine (max. 10)“ im Bearbeiten-Dialog.
- Liste vorhandener Termine mit Datepicker + Löschen-Button.
- Button „Termin hinzufügen“ (deaktiviert ab 10).
- Server-Funktionen in neuer Datei `src/lib/course-sessions.functions.ts`:
  `listSessions`, `upsertSession`, `deleteSession` (mit `requireSupabaseAuth` + Rollencheck via `has_role`).

### 3. Excel-Export
- Dependency: `bun add exceljs` (Worker-kompatibel, reines JS, kein `xlsx`/Node-Bindings).
- Neue Server-Funktion `generateCourseListXlsx` in `src/lib/course-sessions.functions.ts`:
  - Lädt Kurs, Termine (sortiert nach `session_index`), Teilnehmer (`course_participants` mit `status='confirmed'`, sortiert nach Name).
  - Berechnet Alter bei erstem Termin aus `date_of_birth`.
  - Baut Workbook mit ExcelJS:
    - A4 Querformat, Ränder schmal, „fit to 1 page wide“.
    - Kopfzeile: Kursname, Zeitraum (`starts_on`–`ends_on`), Ort.
    - Spalten: Nr · Name · Kursziel erreicht · Klötze · 10× Kurstermin (Datum dd.MM.yyyy oder leer) · Telefon · Alter b. Kursbeginn.
    - Rahmen auf allen belegten Zellen, fette Header-Zeile, automatisch passende Spaltenbreiten.
    - Leere Zellen für „Kursziel erreicht“ und „Klötze“ – nur Rahmen.
  - Rückgabe: `{ filename, base64 }`.
- Dateiname: `Kursliste_<sanitized name>_<YYYY-MM-DD erstes Datum oder starts_on>.xlsx`.

### 4. Frontend-Trigger
- In der Kurs-Tabelle pro Zeile zusätzlicher Button „Excel-Kursliste“ (Icon `FileSpreadsheet`).
- Handler ruft `generateCourseListXlsx` auf, baut Blob aus Base64 und triggert Download über temporären `<a>`-Link.
- Toast bei Fehler/Erfolg.

### 5. Sicherheit & Audit
- Server-Funktionen prüfen Rolle (`admin`/`board`/`trainer`), nutzen `requireSupabaseAuth`.
- `logAudit` für „course_list_exported“ mit `course_id`.

### Technische Details
- Keine `xlsx`-Lib (häufig Node-Binding-Probleme), stattdessen `exceljs` → unterstützt A4-Querformat, Rahmen, `pageSetup.fitToPage`.
- Termine kommen ausschließlich aus `course_sessions` (saubere Datenbasis, dynamisch).
- Bei <10 Terminen bleiben Spalten leer (nur Rahmen).
- Telefon: `participant_phone`; Geburtsdatum: `date_of_birth` (bereits vorhanden).

### Geänderte / neue Dateien
- Migration: `course_sessions`-Tabelle + RLS + GRANTs + Trigger.
- Neu: `src/lib/course-sessions.functions.ts`.
- Geändert: `src/routes/_authenticated/admin/kurse.tsx` (Termin-UI + Export-Button).
- `package.json`: `exceljs`.
