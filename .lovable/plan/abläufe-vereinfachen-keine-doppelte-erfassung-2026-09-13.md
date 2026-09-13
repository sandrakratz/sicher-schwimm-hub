# Abläufe vereinfachen – keine doppelte Erfassung

Ergebnis der Prüfung: Die Abläufe funktionieren, aber Eltern geben dieselben Angaben bis zu viermal ein, und in der Verwaltung gibt es zwei Menüpunkte für dieselbe Liste. Unten steht, was ich dagegen tun würde – nach Nutzen sortiert.

## Was heute mehrfach erfasst wird

- **Eltern:** Name, E-Mail, Telefon, Geburtsdatum werden bei der Warteliste eingegeben, beim Mitgliedsantrag erneut, im Profil nochmals, und die Rechnungsanschrift bei der Kurszusage ein weiteres Mal – ohne dass ein Formular das andere vorausfüllt.
- **Mitglied ja/nein:** Wird bei jeder Kurszuweisung neu über einen Abgleich der E-Mail-Schreibweise geraten, statt fest mit dem Mitgliedsdatensatz verknüpft zu sein. Tippfehler oder eine zweite E-Mail-Adresse führen zum falschen Preis.
- **Telefonnummer:** Trainer pflegen sie im Kurs nach, ohne zu sehen, ob im Profil schon eine aktuellere steht.

## Was in der Verwaltung umständlich ist

- „Kursanfragen (Archiv)" und „Warteliste" sind dieselbe Liste mit zwei Menüpunkten und unterschiedlichen Zugriffsrechten.
- Gesundheitshinweise und die Originalnachricht sieht man erst, wenn man einen Eintrag öffnet – beim Durchsehen der Liste bleiben sie unsichtbar.
- Sperrlisten-Einträge zeigen nicht, zu welcher Anfrage sie gehören.
- Nachrichten von Eltern landen je nach Weg in zwei verschiedenen Ansichten.

## Vorschlag – Schritt 1 (größter Nutzen)

1. **Formulare vorausfüllen:** Wer angemeldet ist, findet bei Warteliste, Mitgliedsantrag und Kurszusage Name, E-Mail, Telefon und Anschrift bereits eingetragen und kann sie nur noch bestätigen oder korrigieren.
2. **Mitgliedschaft fest verknüpfen:** Anfrage und Mitgliedsdatensatz werden dauerhaft miteinander verbunden. Der Mitgliedsstatus – und damit der Preis – stimmt dann automatisch, auch wenn sich der Status später ändert.
3. **Eine Liste statt zwei Menüpunkte:** „Kursanfragen" und „Warteliste" werden zu einer Seite mit Reitern (Warteliste / Zugewiesen / Archiv), gleiche Rechte für Vorstand und Admin.

## Vorschlag – Schritt 2

4. **Wichtiges direkt in der Liste:** Gesundheitshinweis, Notiz und Originalnachricht als Symbol mit Kurzinfo in der Tabellenzeile.
5. **Sperrliste verlinken:** Jeder Eintrag zeigt die zugehörige Anfrage und den Grund.
6. **Telefonnummer eindeutig:** Trainer sehen, woher die Nummer stammt (Profil oder Anmeldung), und pflegen sie an einer Stelle.

## Vorschlag – Schritt 3 (Aufräumen im Hintergrund)

7. Anwesenheit von Teilnehmern und Trainern laufen technisch getrennt, sehen aber fast gleich aus. Zusammenführen spart künftig Pflegeaufwand – für euch ändert sich in der Bedienung nichts. Optional.

## Technische Hinweise

- Vorbefüllung: `profiles`-Lookup in `src/routes/warteliste.tsx`, `src/routes/mitgliedschaft.tsx`, `src/routes/warteliste_.antwort.tsx`.
- Verknüpfung: neue Spalten `profile_id` / `membership_id` auf `course_requests` bzw. `waitlist_entries` inkl. Migration und Backfill über den bisherigen E-Mail-Abgleich; `src/lib/course-assignment.functions.ts:132-138` und `suggestMatchForRequest` lesen danach die Verknüpfung.
- Zusammenlegung: `CourseRequestsAdmin` bekommt Reiter statt `mode`-Prop; `/admin/anfragen` leitet auf `/admin/warteliste` um; Eintrag in `src/lib/nav-items.ts` entfällt.
- Anwesenheit (Schritt 7): `attendance.functions.ts` und `trainer-attendance.functions.ts` gemeinsam mit Typ-Kennzeichen.

## Umfang

Alle drei Schritte werden umgesetzt – zuerst 1, dann 2, zum Schluss das Aufräumen in Schritt 3. Texte, Design und bestehende Abläufe bleiben sonst unverändert.
