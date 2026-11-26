# Löschkonzept (automatische Löschjobs)

Stand: 27.11.2026. Grundlage: Datenschutzerklärung, Ziffern 4, 8, 9, 10 und 10a; Vorstandsentscheidung vom 26.11.2026
(„Löschkonzept 2027“). Aufbewahrung von Buchungsbelegen: **8 Jahre** (§ 147 AO, § 257 HGB in der seit 2025 geltenden Fassung).

Fristen zählen ab dem Anlass (Absage, Termin, letzte Änderung); **Jahresfristen** (3, 5, 8 Jahre) ab dem Ende des
Kalenderjahres, in dem der Anlass liegt. Beispiel 3 Jahre: Anlass 2026 → gelöscht ab 01.01.2030.

## Übersicht der Jobs

| Job (pg_cron, UTC) | Funktion | Inhalt |
|---|---|---|
| `retention-cleanup-daily` 02:30 | `run_retention_cleanup()` | Versandprotokoll, Widerrufe, Gesundheitsangaben, Notizen, Gurt-Stand (3 Jahre) |
| `retention-2027-daily` 02:40 | `run_retention_2027(false)` | alle Fristen des Löschkonzepts 2027 (unten) – **wird erst nach dem Probelauf im Februar 2027 eingeplant** |
| `analytics-rollup-daily` 02:45 | `run_analytics_rollup()` | Einzelne Messdaten nach 90 Tagen |
| `member-account-cleanup-daily` 03:00 | Endpunkt `/api/public/hooks/member-account-cleanup` | Login 30 Tage nach Mitgliedschaftsende |
| `family-swim-scrub-daily` 03:30 | `family_swim_scrub()` | Mitgliederschwimmen: Personen nach 6 Monaten, Anwesenheit nach 2 Jahren |

Jeder Lauf mit Treffern steht im Änderungsprotokoll (`audit_logs`, Aktionen `retention_cleanup` bzw. `retention_cleanup_2027`).

## Löschkonzept 2027 (`run_retention_2027`)

Migration `20261127120000_retention_2027.sql`. Ohne Argument ist es ein **Probelauf**: Alle Schritte laufen in einem
Teilblock, werden gezählt und zurückgerollt; es ändert sich nichts. `run_retention_2027(false)` löscht wirklich.
Im Verwaltungsbereich startet der Eingang ab 10.02.2027 den Probelauf per Knopf („Löschjob: Probelauf prüfen und einplanen“).

| Daten | Frist | Aktion |
|---|---|---|
| Anwesenheit der Kinder (`course_attendance`) | 2 Jahre nach dem Termin | löschen |
| Trainer: Anwesenheit, Einteilung, Verfügbarkeit, Dienstplan-Protokoll | 2 Jahre nach dem Termin | löschen |
| Prüfungsangaben in Buchungen (`exam_*`, Abzeichen, Ergebnis) | 5 Jahre nach Prüfungsjahr | Felder leeren |
| Externe Abzeichenprüfungen (`external_badge_exams`) | 5 Jahre nach Prüfungsjahr | löschen |
| Buchung abgesagt, nie bezahlt, ohne Anwesenheit und Prüfung | 6 Monate nach Absage/Herausnahme | löschen |
| Buchung nie bezahlt, Kurs vorbei (offene Forderung) | 3 Jahre nach Kursjahr | löschen |
| Bezahlte Buchung: Kontakt, Notizen, Gründe, Gurt, Push-Token, Geburtsdatum (ohne Prüfung) | 3 Jahre nach Kursjahr | Felder leeren → **Beleg-Kern** |
| Beleg-Kern (Kind, Rechnungsanschrift, Kurs, Betrag, Daten, Nummern) | 8 Jahre nach Zahlungsjahr | löschen |
| Push-Abos der Eltern | 1 Monat nach Kursende bzw. Absage | löschen |
| Nie bestätigte Umbuchungs-Links | 6 Monate nach Anlage | löschen |
| Warteliste (abgemeldet, abgesagt, Frist abgelaufen, gebucht) | 6 Monate nach letzter Änderung | löschen |
| Kursanfragen (abgelehnt, angenommen, Warteliste) ohne aktiven Wartelisteneintrag und ohne laufende Buchung | 6 Monate nach letzter Änderung | löschen |
| Interessen Erwachsenenkurs („kein Interesse“, „übernommen“) | 6 Monate | löschen |
| Kontaktformular („beantwortet“, „archiviert“) | 6 Monate | löschen |
| Helfer-Rückmeldungen zu Events | 6 Monate nach dem Event | löschen |
| Rundschreiben im Portal | 2 Jahre nach Versand | löschen |
| Beendete Mitgliedschaften (samt Volljährigkeits-Bestätigung) | 3 Jahre nach „gültig bis“ | löschen |
| Sperrliste | 2 Jahre nach Eintrag, außer verlängert (`keep_until`) | löschen |
| Übungsleiter-Auszahlungen (samt Posten) und Jahreserklärungen | 8 Jahre nach dem Jahr | löschen |
| Änderungsprotokoll (`audit_logs`) | 24 Monate | löschen |

Bewusst **nicht** gelöscht: bestätigte Umbuchungs-Zustimmungen (enthalten die Gebühr, gehören zum Beleg) und
Volljährigkeits-Bestätigungen (Einwilligungsnachweis) – sie gehen mit der Buchung bzw. Mitgliedschaft. Die
E-Mail-Sperrliste (`suppressed_emails`, Abmeldungen und Rückläufer) bleibt dauerhaft, sonst wirkt eine Abmeldung nicht.

**Sperrliste:** Die Seite zeigt „Bleibt bis“; „Verlängern“ setzt `keep_until` auf heute + 2 Jahre. Der Eingang
erinnert 4 Wochen vor Ablauf.

## Bestehender Job (`run_retention_cleanup`, seit 01.10.2026)

Frist 3 Jahre nach Ablauf des Kalenderjahres: Versandprotokoll `email_send_log` und Widerrufe `cancellation_requests`
(Zeile löschen); Gesundheitsangaben `course_requests.health_info`, Notizen `course_participants.notes`,
Gurt-Stand `course_participants.belt_blocks`, Notizen `waitlist_entries.notes` (Feld leeren).

## Konten und Verknüpfungen

- **Mitgliederzugänge:** Das Login wird gelöscht, wenn alle Mitgliedschaften ein „gültig bis“ haben, das 30 Tage oder
  länger zurückliegt (`member-account-cleanup-daily`). Nie gelöscht werden Konten mit Rolle Admin/Vorstand/Trainer, mit
  laufenden Kursbuchungen oder mit einer Mitgliedschaft ohne „gültig bis“. Voraussetzung: Die Verwaltung trägt nach
  gültiger Kündigung „gültig bis“ ein.
- Seit Migration `20261127090000_keep_records_on_account_delete.sql` bleiben beim Löschen eines Kontos
  Mitgliederschwimmen-Anmeldungen, Kursbuchungen und „erfasst von“-Angaben erhalten (`ON DELETE SET NULL`); sie
  folgen danach ihren eigenen Fristen.
- **Aus dem Kurs nehmen** löscht keine Buchung mehr (Status abgesagt + `removed_at`); **Mitgliedschaften** lassen sich
  nur als nie genehmigter Antrag löschen. Beides folgt den Fristen oben.
- Kurstermine mit erfasster Anwesenheit lassen sich nicht löschen oder per Terminliste ersetzen.

## Mitgliederschwimmen (eigener Job)

`public.family_swim_scrub()`: **6 Monate nach dem Termin** werden Personen-, Kontakt- und Aufsichtsangaben sowie
Anmerkungen geleert, der Zähler (Teilnahmen, Strafpunkte) bleibt. **2 Jahre nach dem Termin** wird die
Anwesenheitserfassung gelöscht (Versicherungsnachweis; vorher als PDF unter /admin/familienschwimmen ausdruckbar).

## Einspielen und Kontrolle

1. Migration im Supabase SQL-Editor ausführen.
2. Probelauf: `select public.run_retention_2027();` bzw. `select public.run_retention_cleanup(true);`
3. Einplanen (Löschkonzept 2027, nach Freigabe der Probelauf-Zahlen):
   `select cron.schedule('retention-2027-daily', '40 2 * * *', $$select public.run_retention_2027(false)$$);`
4. Zeitplan prüfen: `select jobname, schedule, active from cron.job order by jobname;`
5. Ergebnis ansehen: `select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;`

Gelöscht wird endgültig. Wer frühere Daten noch braucht, sollte vorher eine Sicherung exportieren.

## Noch offen (von Hand bzw. später)

- **Führungszeugnisse** (`trainer_qualifications`, Art „Führungszeugnis“): laut Datenschutzbericht bis Ausscheiden,
  höchstens 3 Monate nach Beendigung – noch kein Job.
- Trainerkonten und Bankverbindungen (`trainer_payout_details`) nach Ausscheiden und letzter Abrechnung von Hand entfernen.
- Hochgeladene Dateien (Buckets `documents`, `media`) jährlich prüfen.
