# Trainerbereich ausbauen, Verwaltung aufräumen

## Was sich ändert

1. **„Verfügbarkeit“ unter Verwaltung entfällt.** Der Menüpunkt und die Seite werden entfernt; Aufrufe der alten Adresse leiten auf „Meine Verfügbarkeit“ im Trainerbereich um. Admin und Vorstand sehen den Trainerbereich weiterhin, die Funktion geht also nicht verloren.

2. **„Vereinsmitglieder“ unter Verwaltung entfällt.** Menüpunkt und Seite werden entfernt (dort waren nur die Hauptmitglieder gelistet), Aufrufe leiten auf die neue Mitgliederliste im Trainerbereich um.

3. **Neu im Trainerbereich: „Vereinsmitglieder“.** Vollständige Liste aller aktiven Mitgliedschaften, bei Familien zusätzlich aufgeklappt Partner:in und Kinder mit Geburtsdatum. Telefon und E-Mail werden aus der Mitgliedschaft angezeigt (Partner und Kinder haben in den Anträgen nur Name + Geburtsdatum hinterlegt, es gibt dort keine eigenen Kontaktdaten). SEPA-/Bankdaten werden bewusst **nicht** ausgegeben – sie verlassen den Server gar nicht erst. Mit Suchfeld über Namen aller Familienmitglieder.

4. **Neu im Trainerbereich: „Meine Kurse“.** Für jeden Kurs, dem der/die Trainer:in zugeteilt ist (als Kurstrainer oder über einen Termin), die Teilnehmerliste mit Name, Geburtsdatum, Kontaktdaten der Eltern, Notizen/Gesundheitshinweisen sowie Status. Zu den Zahlungen wird nur angezeigt, ob bezahlt wurde oder nicht – Betrag und Zahlungsart bleiben ausgeblendet.

## Technische Umsetzung

- `src/lib/nav-items.ts`: Einträge `/admin/verfuegbarkeit` und `/admin/mitglieder` entfernen; `trainerNav` um `/trainer/kurse` und `/trainer/mitglieder` erweitern (Rollen `admin`, `board`, `trainer`).
- `src/routes/_authenticated/admin/verfuegbarkeit.tsx` und `admin/mitglieder.tsx` werden zu reinen Redirect-Routen (`beforeLoad` → `/trainer/verfuegbarkeit` bzw. `/trainer/mitglieder`), damit gespeicherte Links nicht ins Leere laufen. Die Board-Komponente `src/components/trainer/AvailabilityBoard.tsx` bleibt unverändert.
- `src/lib/members-list.functions.ts`: `listActiveMembers` erweitern um `email`, `phone`, `date_of_birth` und `family_members` (Partner + Kinder mit Namen/Geburtsdatum). Rollenprüfung (`admin`/`board`/`trainer`) bleibt; die Auswahlliste im Select enthält weiterhin keine `sepa_*`-Felder.
- Neue Serverfunktion `src/lib/trainer-courses.functions.ts`: ermittelt über `courses.trainer_id`, `course_sessions.assigned_trainer_id` und `course_session_assignments` die eigenen Kurse und liefert die zugehörigen `course_participants` ohne Zahlungsfelder zurück.
- Neue Seiten `src/routes/_authenticated/trainer/mitglieder.tsx` und `src/routes/_authenticated/trainer/kurse.tsx` mit derselben Rollenprüfung (`assertHasAnyRole`) und `noindex`-Metadaten wie die bestehenden Trainerseiten.
- Keine Datenbankänderung nötig.
