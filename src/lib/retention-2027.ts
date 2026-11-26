// Löschkonzept 2027: Erinnerung im Eingang, den Löschjob nach einem Probelauf einzuplanen.
// Ab REVIEW_FROM sind die ersten Fristen erreicht (Kontaktformular, Kursanfragen), der Probelauf zeigt
// dann echte Zahlen. Die Erinnerung endet, sobald der Job einmal echt gelaufen ist (Eintrag
// „retention_cleanup_2027“ im Änderungsprotokoll).

export const RETENTION_REVIEW_FROM = "2027-02-10";
export const RETENTION_SCHEDULE_SQL =
  "select cron.schedule('retention-2027-daily', '40 2 * * *', $$select public.run_retention_2027(false)$$);";

export function retentionReviewDue(today: string, activated: boolean): boolean {
  return !activated && today >= RETENTION_REVIEW_FROM;
}

/** Anzeigenamen der Zähler aus run_retention_2027 (in der Reihenfolge des Löschkonzepts). */
export const RETENTION_LABELS: [key: string, label: string][] = [
  ["kursanfragen", "Kursanfragen (6 Monate nach Abschluss)"],
  ["warteliste", "Warteliste (6 Monate nach Abmeldung, Absage, Ablauf, Buchung)"],
  ["erwachsenen_interessen", "Interessen Erwachsenenkurs (6 Monate)"],
  ["kontaktformular", "Kontaktformular (6 Monate nach Erledigung)"],
  ["buchung_nie_bezahlt", "Buchungen nie bezahlt, beendet (6 Monate)"],
  ["buchung_offene_forderung", "Gebucht, nie bezahlt, Kurs vorbei (3 Jahre)"],
  ["anwesenheit_kinder", "Anwesenheit der Kinder (2 Jahre)"],
  ["buchung_auf_beleg_kern", "Bezahlte Buchungen auf Beleg-Kern geschrumpft (3 Jahre)"],
  ["beleg_kern_geloescht", "Beleg-Kern gelöscht (8 Jahre)"],
  ["pruefung_geleert", "Prüfungsangaben geleert (5 Jahre)"],
  ["externe_pruefungen", "Externe Abzeichenprüfungen (5 Jahre)"],
  ["umbuchungs_links_offen", "Nie bestätigte Umbuchungs-Links (6 Monate)"],
  ["push_abos", "Push-Abos der Eltern (1 Monat nach Kursende)"],
  ["mitgliedschaften", "Beendete Mitgliedschaften (3 Jahre nach Ende)"],
  ["sperrliste", "Sperrliste (2 Jahre, außer verlängert)"],
  ["rundschreiben", "Rundschreiben im Portal (2 Jahre)"],
  ["trainer_anwesenheit", "Trainer: Anwesenheit (2 Jahre)"],
  ["trainer_einteilung", "Trainer: Einteilung (2 Jahre)"],
  ["trainer_verfuegbarkeit", "Trainer: Verfügbarkeit (2 Jahre)"],
  ["dienstplan_protokoll", "Dienstplan-Protokoll (2 Jahre)"],
  ["helfer_rueckmeldungen", "Helfer-Rückmeldungen Events (6 Monate)"],
  ["trainer_auszahlungen", "Übungsleiter-Auszahlungen (8 Jahre)"],
  ["trainer_erklaerungen", "Übungsleiter-Jahreserklärungen (8 Jahre)"],
  ["aenderungsprotokoll", "Änderungsprotokoll (24 Monate)"],
];
