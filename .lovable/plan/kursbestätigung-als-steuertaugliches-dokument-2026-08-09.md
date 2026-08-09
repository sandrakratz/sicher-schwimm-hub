# Kursbestätigung als steuertaugliches Dokument

Die Buchungsbestätigungs-E-Mail wird zu einem vollwertigen Beleg „Kursbestätigung und Zahlungsaufforderung" umgebaut, jeder Buchung wird eine fortlaufende Dokument-Nr. zugewiesen, und in der Kursverwaltung lassen sich alle Bestätigungen eines Kurszeitraums gesammelt als PDF herunterladen.

## Dokumentaufbau

Kopf: Sicher-Schwimmen e. V., Bergstr. 67a, 53773 Hennef, Vereinsregister: Amtsgericht Siegburg, VR 4149.

Inhalt:
- Titel „Kursbestätigung und Zahlungsaufforderung", Dokument-Nr. (Format `SK-2026-00123`), Ausstellungsdatum
- Zahlungspflichtige/r: Name + Anschrift der Eltern
- Teilnehmer/in: Name des Kindes
- Gebuchter Schwimmkurs: Kurs, Kurszeitraum, Kurstage/Zeiten, Anzahl der Einheiten
- Kursgebühr in €
- Zahlungsaufforderung mit Fälligkeitsdatum (Ausstellung + Zahlungsfrist, spätestens einen Tag vor Kursbeginn), Kontoinhaber, IBAN, BIC, Verwendungszweck `SK-2026-00123 / [Name des Kindes]`
- Hinweis: „Gemäß § 19 UStG wird keine Umsatzsteuer berechnet."
- Dankesatz, „Hennef, [Datum]", Unterzeichner (Vorstand) und Kontakt (info@sicher-schwimmen.com, Telefon)

Wartelisten-Anmeldungen bekommen weiterhin die bisherige Wartelisten-E-Mail ohne Zahlungsaufforderung und ohne Dokument-Nr.

## Neue Eingaben

- **Buchungsformular** (`/kurse`): Straße & Hausnummer, PLZ, Ort der Eltern als Pflichtfelder.
- **Kursverwaltung**: pro Kurszeitraum ein neues Feld „Anzahl der Einheiten" (optional; wird nur angezeigt, wenn gepflegt).

## Sammel-Download

In der Kurs-Detailansicht, in der Zeitraum-Zeile neben „Excel" und „Steuerliste", zwei neue Aktionen:
- **Bestätigungen (PDF)**: ein PDF mit einer Seite je bestätigtem Teilnehmer
- **Bestätigungen (ZIP)**: je Teilnehmer eine eigene PDF-Datei, gebündelt als ZIP

Enthalten sind alle bestätigten Teilnehmer des Zeitraums (Warteliste/storniert nicht). Fehlt bei Altbuchungen die Anschrift, wird die Zeile leer gelassen und im Adminbereich nachtragbar (Teilnehmer-Dialog).

## Technisches

- Migration: `course_participants` erhält `payer_street`, `payer_zip`, `payer_city`, `document_no` (text, unique) und `document_issued_at`; `courses` erhält `unit_count` (int). Bestehende GRANT-/RLS-Struktur bleibt, keine neuen Policies nötig.
- Dokument-Nr.: Postgres-Sequenz + `generate_course_document_no()` (SECURITY DEFINER), Format `SK-<Jahr>-<5-stellig>`; wird bei bestätigter Buchung in `bookCourseTerm` und bei manueller Bestätigung/Zuweisung (`course-assignment.functions.ts`) vergeben, falls noch nicht vorhanden.
- Vereinsstammdaten (Anschrift, Register, Kontakt, Ort für Unterschriftszeile, § 19 UStG-Hinweis) zentral in `src/lib/billing-config.ts` ergänzen; E-Mail und PDF nutzen dieselbe Quelle.
- E-Mail-Template `course-booking-confirmation.tsx` auf das neue Belegschema umbauen (neue Props: `document_no`, `issued_at`, `due_date`, `payer_*`, `unit_count`, Vereinsdaten). Verwendungszweck in `courses-public.functions.ts` und `course-assignment.functions.ts` auf `SK-… / Kind` umstellen.
- PDF-Erzeugung serverseitig mit `pdf-lib` (Worker-kompatibel, reines JS), ZIP mit `fflate`. Neue Server-Funktion `generateCourseConfirmations` in `src/lib/course-sessions.functions.ts` mit `requireSupabaseAuth`, Rollenprüfung admin/board/trainer, Parameter `{ courseId, format: 'pdf' | 'zip' }`, Rückgabe Base64 + Dateiname; Audit-Eintrag `course_confirmations_exported`.
- UI-Änderungen in `src/routes/kurse.tsx` (Adressfelder), `src/routes/_authenticated/admin/kurse.tsx` (Feld „Einheiten", zwei Download-Buttons, Adressfelder im Teilnehmer-Dialog).
