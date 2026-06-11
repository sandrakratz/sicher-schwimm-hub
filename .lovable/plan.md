## Ziel

Die Kurszuteilung-Email enthält künftig korrekte Dauer, Preis je nach Mitgliedschaft, Zahlungsdaten, Hinweise zu Kursordnung & AGB. Im Admin lässt sich beim Einbuchen Mitgliedstatus und Elternkonto wählen (mit automatischem Vorschlag). Bestätigte Kurse erscheinen im Elternportal.

## 1. Datenbank-Erweiterungen (Migration)

**`courses`** – neue Felder:
- `price_member` (numeric) – z.B. 150
- `price_non_member` (numeric) – z.B. 200
- `payment_due_days` (int, default 14)

**`course_participants`** – neue Felder:
- `is_member` (boolean, nullable) – Mitgliedsstatus zum Zeitpunkt der Buchung
- `member_confirmed` (boolean, default false) – von Buchhaltung bestätigt
- `member_confirmed_at`, `member_confirmed_by`
- `price_amount` (numeric) – fixierter Preis (Snapshot)
- `parent_user_id` (uuid, fk auf auth.users, nullable) – verknüpftes Elternkonto

**Indizes / RLS-Update**: Policy „Users view own enrollments" erweitern, sodass auch `parent_user_id = auth.uid()` sieht (= Eltern sehen ihre Kinder-Kurse).

## 2. Admin „In Kurs einbuchen" Dialog (`anfragen.tsx` + `course-assignment.functions.ts`)

Neue Felder im Einbuch-Dialog:
- **Mitglied?** Dropdown „Ja / Nein / Unklar" – vorbelegt per E-Mail-Match auf `memberships.email` (status=active) ODER `profiles.email`. Server prüft das in der Assignment-Funktion und gibt einen Vorschlag zurück.
- **Elternkonto verknüpfen** Combobox aller Profile, vorbelegt per E-Mail-Match auf `profiles.email`. „Keines" möglich – dann läuft Verknüpfung später automatisch beim Registrieren über `handle_new_user`-Trigger (E-Mail-Match).
- **Preis (€)** wird automatisch aus `is_member` × Kurs-Preisen vorbelegt, editierbar.

Server-Fn schreibt diese Felder in `course_participants` und übergibt Preis + Mitgliedstatus + Zahlungsfrist + Bankdaten + Verwendungszweck an das Email-Template.

## 3. Admin-Kursverwaltung (`admin/kurse.tsx`)

- Kurs-Bearbeitung: Felder `price_member`, `price_non_member`, `payment_due_days`.
- Teilnehmer-Edit-Dialog: zusätzliches Feld „Mitglied bestätigt" (Buchhaltung), Eltern-Verknüpfung änderbar, Preis editierbar.
- Teilnehmer-Tabelle: neue Spalte „Mitglied" (Badge: Mitglied/Nicht-Mitglied/offen, grün wenn bestätigt).

## 4. Email-Template `course-assignment.tsx`

Erweiterungen:
- „Dauer: **5 Wochen**" (Wort „Wochen" anhängen, sofern Eingabe nur eine Zahl ist; alternativ direkt im Datenbankfeld so eingetragen lassen – wir hängen das Suffix nur an, wenn es eine reine Zahl ist).
- Neuer Abschnitt **Zahlungsinformationen**:
  - Mitgliedsstatus-Anzeige (Mitglied / Nicht-Mitglied)
  - Betrag in € fett
  - Zahlungsfrist: „bitte innerhalb von 14 Tagen ab Erhalt dieser E-Mail"
  - Empfänger / IBAN / BIC (Platzhalter `{{IBAN}}` etc., bleibt zunächst leer – als Hinweis „wird in Kürze ergänzt")
  - Verwendungszweck: `{Kursname} – {Kindname}`
- Neuer Abschnitt **Wichtige Hinweise**:
  - Link zur Kursordnung (`/kursbedingungen`)
  - Link zu den AGB / Datenschutz
  - Hinweis: „Mit der Anmeldung gelten Kursordnung und AGB als akzeptiert."

Bankdaten kommen aus einer kleinen Config (z.B. `src/lib/config.server.ts` oder neue Datei `src/lib/billing-config.ts`) – zunächst leere Strings, leicht später zu füllen.

## 5. Elternportal – „Meine Kurse" (`portal/kurse.tsx`)

Placeholder ersetzen durch echte Liste:
- Query: `course_participants` wo `parent_user_id = auth.uid()` ODER `user_id = auth.uid()`, mit Join auf `courses`.
- Karten pro Kurs mit: Kursname, Kind (`participant_name`), Zeitraum, Ort, Zeiten, Status, Zahlungsstatus (offen/bezahlt), Mitgliedstatus, Preis.
- Dashboard `portal/index.tsx`: Statistik-Kachel „Kurse" hinzufügen (Count) und Link.

## 6. Auto-Verknüpfung bestehender/neuer Eltern-Accounts

Trigger-Erweiterung in `handle_new_user`: nach Registrierung wird `course_participants` durchsucht, wo `parent_user_id IS NULL AND participant_email = NEW.email` und dort `parent_user_id = NEW.id` gesetzt. So tauchen Kurse rückwirkend im Portal auf, sobald sich das Elternteil registriert.

## Reihenfolge der Umsetzung

1. Migration (Felder, RLS, Trigger-Update)
2. `course-assignment.functions.ts` (Mitglieds- & Eltern-Match, Preis-Snapshot, neue Template-Variablen)
3. `anfragen.tsx` Einbuch-Dialog erweitern
4. `admin/kurse.tsx` Preise + Mitglied bestätigt + Eltern-Verknüpfung
5. `course-assignment.tsx` Email-Template
6. `portal/kurse.tsx` Liste + Dashboard-Kachel

## Offen / Hinweis an den Nutzer

- Bankverbindung bleibt im Email-Template aktuell als leere Platzhalterzeilen („Empfänger: ___ / IBAN: ___ / BIC: ___") mit Hinweis „wird in Kürze ergänzt". Sobald du die Daten hast, trage ich sie zentral in einer Konfigurationsdatei ein.
- Preise (150 € Mitglied / 200 € Nicht-Mitglied) werden bei neuen Kursen als Default vorgeschlagen, sind aber pro Kurs änderbar.
