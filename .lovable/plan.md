# Ablaufinformationen zum Kurs

Eltern erfahren heute nur Termin, Ort, Preis und Zahlung. Wie der Kurstag konkret abläuft (Treffpunkt, Ankunftszeit, was mitzubringen ist) fehlt überall. Der Text wird einmal je Kurs gepflegt und dann an drei Stellen automatisch ausgespielt.

## Was entsteht

1. **Feld „Ablauf & Wichtiges für den Kurstag“** in der Kursverwaltung – je Kurs pflegbar, beim Anlegen aus dem Kursangebot (Vorlage) vorbelegt, jederzeit überschreibbar.
2. **Kursdetailseite** – der Text erscheint als eigener, gut lesbarer Abschnitt („Ablauf & Wichtiges“) unterhalb der Kursbeschreibung. Ist kein Text hinterlegt, erscheint nichts.
3. **Buchungsbestätigung und Kurszuteilung** – derselbe Text wird als Abschnitt in beide E-Mails übernommen.
4. **Erinnerungs-E-Mail 3 Tage vor Kursstart** – neue Vorlage „Bald geht's los“ mit Kursname, Kind, erstem Termin mit Datum und Uhrzeit, Ort und dem Ablauftext. Geht einmalig an alle bestätigten Teilnehmenden eines Kurses; Wartelistenplätze und stornierte Plätze erhalten nichts.

Der Kurstag-Text ist frei formulierbar (mehrzeilig, Absätze und Aufzählungen bleiben erhalten). Du lieferst den Inhalt, ich lege ihn als Standardvorlage bei den Kursangeboten an.

## Nebenbefund

In den bisherigen E-Mails steht als Kurszeit „Sonntags 12:00–13:30 Uhr“, im Terminplan sind die Termine aber mit 12:00–14:00 Uhr hinterlegt. Die Erinnerungsmail nennt künftig die Uhrzeit aus dem Terminplan. Welche Angabe die richtige ist, klären wir kurz, damit beides zusammenpasst.

## Technische Umsetzung

- Migration: `courses.course_info text` und `course_programs.course_info text` (nullable). Beim Erzeugen eines Kurses aus einem Programm wird der Programmtext kopiert. Keine RLS-Änderung nötig (bestehende Policies decken die Spalten ab).
- Admin-UI: Textarea im Kurs-Dialog (`src/routes/_authenticated/admin/kurse.tsx`) und im Programm-Dialog, inkl. Speicherung in den bestehenden Save-Funktionen.
- Öffentliche Anzeige: `src/routes/kurse_.$slug.tsx` – Abschnitt mit `whitespace-pre-line`, nur wenn Text vorhanden; Feld in der öffentlichen Kursabfrage (`src/lib/courses-public.functions.ts`) ergänzen.
- E-Mail-Vorlagen: optionales Prop `course_info` in `course-booking-confirmation.tsx` und `course-assignment.tsx`, gerendert als eigener Abschnitt; `templateData` an den Sendestellen ergänzen.
- Neue Vorlage `src/lib/email-templates/course-start-reminder.tsx` plus Registrierung in `registry.ts`.
- Versand: neue öffentliche Route `src/routes/api/public/hooks/course-start-reminder.ts` (Muster wie `payment-check-reminder.ts`), Secret-geschützt, sucht Kurse mit `starts_on = heute + 3 Tage` (Europe/Berlin), sendet je bestätigtem Teilnehmer mit `idempotencyKey` `course-start-${participantId}`, protokolliert in `email_send_log`.
- Zeitsteuerung: ein `pg_cron`-Job einmal täglich um 08:00 Berliner Zeit ruft diese Route auf. Einmal täglich reicht, da der Stichtag tagesgenau ist; dadurch entstehen keine nennenswerten laufenden Kosten.
- Erste Kurstermin-Uhrzeit kommt aus `course_sessions.start_time`/`end_time`, Fallback auf `courses.schedule`.
