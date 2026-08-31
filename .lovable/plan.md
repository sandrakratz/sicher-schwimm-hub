# Warteliste mit automatischer Platzvergabe

Eltern tragen sich künftig selbst auf die Warteliste ein – entweder für ein Kursangebot (z. B. „Seepferdchen“) oder für einen konkreten, ausgebuchten Kurs. Wird ein Platz frei oder ein Kurs geöffnet, vergibt das System die Plätze automatisch: Aktive Vereinsmitglieder zuerst, danach nach Eingangsdatum. Die Eltern erhalten ein Platzangebot per E-Mail mit Zusage-Link und Frist; ohne Reaktion rückt der Nächste nach.

## Ablauf für Eltern

1. Auf der Kursübersicht und den Kursdetailseiten gibt es den Button „Auf die Warteliste“ (bei ausgebuchten Kursen und bei geplanten Angeboten ohne Termin).
2. Kurzes Formular: Name des Kindes, Geburtsdatum, Eltern-Name, E-Mail, Telefon, Hinweise, Datenschutz-Einwilligung. Bestätigungs-Modal wie bei den anderen Formularen, kein Login nötig.
3. Bestätigungs-E-Mail „Sie stehen auf der Warteliste“ mit Angabe von Angebot/Kurs.
4. Wird ein Platz frei: E-Mail „Platzangebot“ mit Kursdaten, Preis, Zahlungsbedingungen und zwei Links – Zusagen oder Absagen. Frist standardmäßig 3 Tage (im Admin einstellbar).
5. Zusage → Platz wird verbindlich gebucht, es folgt die reguläre Buchungsbestätigung inkl. Zahlungsinfos und Beleg. Absage oder Fristablauf → Eintrag wird geschlossen bzw. auf Wunsch weiter auf der Warteliste geführt, der nächste Wartende bekommt automatisch das Angebot.

## Reihenfolge der Vergabe

1. Aktive Vereinsmitglieder (Abgleich über die E-Mail-Adresse mit den Mitgliedschaften)
2. Danach nach Eintragungsdatum (wer zuerst kam, zuerst)

## Automatik

- Ein Kurs bekommt ein Platzkontingent (bestehendes Feld „max. Teilnehmer“). Freie Plätze = Kontingent minus bestätigte und offene Angebote.
- Ausgelöst wird die Vergabe automatisch, wenn: ein Kurs auf „offen“ gesetzt oder neu angelegt wird, ein Teilnehmer storniert wird, oder ein Platzangebot abgelehnt bzw. abgelaufen ist.
- Zusätzlich gibt es im Verwaltungsbereich den Button „Warteliste jetzt vergeben“ (pro Kurs und global).
- Eine stündliche Hintergrundprüfung schließt abgelaufene Angebote und rückt nach. Sie läuft 24-mal pro Tag; das ist nötig, damit Fristen auch ohne Admin-Aktion enden – häufigere Läufe würden die laufenden Kosten erhöhen, seltenere würden Plätze länger blockieren.

## Verwaltungsbereich

Der bestehende Menüpunkt „Warteliste“ wird erweitert:

- Liste pro Angebot/Kurs mit Position, Mitgliedsstatus, Eintragungsdatum, Status (wartend, Angebot offen bis …, zugesagt, abgesagt, abgelaufen).
- Aktionen: Platz manuell anbieten, Angebot zurückziehen, Position verschieben, Eintrag entfernen, direkt in einen Kurs einbuchen.
- Anzeige freier Plätze je Kurs sowie „Warteliste jetzt vergeben“.
- Die bisherigen Kursanfragen mit Status „Warteliste“ bleiben sichtbar und lassen sich per Klick in die neue Warteliste übernehmen.

## Technische Umsetzung

Datenbank (eine Migration):

- Neue Tabelle `waitlist_entries`: `program_id` (optional), `course_id` (optional), Kind- und Elterndaten, `is_member`, `parent_user_id`, `status` (`waiting` | `offered` | `accepted` | `declined` | `expired` | `removed`), `offer_token`, `offered_at`, `offer_expires_at`, `offer_course_id`, `notes`, Zeitstempel + Update-Trigger.
- Grants: `authenticated` (lesen/schreiben über Policies), `service_role` voll, `anon` nur INSERT für die öffentliche Eintragung; RLS aktiv, Verwaltung nur für `is_staff`, Eltern sehen eigene Einträge über `parent_user_id`.
- Optional `waitlist_offer_days` (Standard 3) in `course_programs`.
- Vorhandene Kursanfragen mit Status `waiting_list` werden per Migration in die neue Tabelle übernommen.

Anwendungscode:

- `src/lib/waitlist.functions.ts`: öffentliche Eintragung (unauthentifiziert, mit Blocklist-Prüfung analog Buchung), Zusage/Absage über Token, Admin-Funktionen (Liste, manuelles Angebot, Entfernen, Vergabe auslösen).
- `src/lib/waitlist.server.ts`: Kernlogik `allocateWaitlist(courseId?)` – freie Plätze ermitteln, sortieren (Mitglied → FIFO), Angebote erzeugen, E-Mails auslösen; `expireOffers()` für abgelaufene Angebote.
- Zusage erzeugt einen `course_participants`-Eintrag mit `status = 'confirmed'`, Dokumentnummer, Preis und den bestehenden Zahlungsbedingungen (`paymentTerms`) – identisch zur regulären Buchung inkl. Buchungsbestätigung und PDF-Beleg.
- Neue E-Mail-Vorlagen: `waitlist-confirmation`, `waitlist-offer`, `waitlist-offer-expired`, sowie Admin-Info bei Zusage; Registrierung in `src/lib/email-templates/registry.ts`.
- Öffentliche Routen: `/warteliste` (Formular, mit Vorauswahl über Query-Parameter) und `/api/public/waitlist/respond` für Zusage/Absage per Token.
- Cron-Endpunkt `src/routes/api/public/hooks/waitlist-sweep.ts` + stündlicher `pg_cron`-Job.
- Anpassungen: Buttons auf `src/routes/kurse.tsx` und `src/routes/kurse_.$slug.tsx`, Auslösung der Vergabe in `src/lib/course-assignment.functions.ts` (Storno) und in der Kursverwaltung beim Öffnen eines Kurses, Erweiterung von `src/components/admin/CourseRequestsAdmin.tsx` bzw. neue Wartelisten-Komponente für `/admin/warteliste`.
