# Erwachsenenschwimmen – Abschlussprüfung (29.10.2026)

Stand: nichts committet, nichts in der Produktionsdatenbank eingespielt.

## 1. Löschfrist / Datenschutzerklärung
- Die zuerst eingetragene Frist „spätestens 12 Monate“ hatte **keine Grundlage** (weder gesetzlich noch eine Vorgabe des Vereins) und wurde nicht technisch umgesetzt. Sie ist entfernt.
- Jetzt steht in `datenschutz.tsx` eine zweckgebundene Formulierung: gespeichert wird nur zur Planung des Kurses und zur Information über die spätere Anmeldung; Löschung, sobald der Kurs begonnen hat oder abgesagt wurde, bei Wegfall des Interesses oder bei Widerruf.
- Grundlage: Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, Häkchen im Formular, Zeitpunkt in `privacy_accepted_at`); Speicherbegrenzung nach Art. 5 Abs. 1 lit. e DSGVO – es gibt keine gesetzliche Mindest- oder Höchstfrist, der Verein legt sie nach dem Zweck fest (Art. 13 Abs. 2 lit. a: Dauer oder Kriterien genügen).
- **Offen:** Es gibt keine automatische Löschung. Gelöscht wird von Hand („Löschen“ in der Verwaltung). Ob zusätzlich eine feste Frist (z. B. X Monate nach Kursbeginn) genannt und automatisiert werden soll, entscheidet der Vorstand. Rechtliche Endabnahme des Textes bei Vorstand/Datenschutzberatung.

## 2. Migration `20261029120000_adult_course_interests.sql`
In einer lokalen Wegwerf-Postgres (PGlite, nicht Produktion) mit nachgebauten Rollen/Tabellen getestet:
- zweimal hintereinander einspielbar (Policies/Trigger per `DROP … IF EXISTS`, Tabelle/Index/Kursangebot per `IF NOT EXISTS`);
- Kursangebot wird genau einmal angelegt: öffentlich, `bookable = false`, `waitlist_open = false`, 159 € / 179 €;
- Doppelte E-Mail (auch anders geschrieben) wird vom Index blockiert, ungültige Auswahlwerte von den CHECKs;
- Rechte: anon hat keinerlei Zugriff; angemeldete Nutzer ohne Vorstandsrolle (auch Trainer) sehen/ändern/löschen 0 Zeilen, können nicht einfügen und nicht `TRUNCATE`n; Vorstand/Admin dürfen lesen und ändern.
- Gegenüber dem ersten Entwurf geändert: Standardrechte werden ausdrücklich entzogen (`REVOKE`), `program_id` ist `NOT NULL` mit `ON DELETE RESTRICT` (sonst wäre die Doppelerkennung mit leerem Wert umgehbar).
- Nicht geprüft: echte Supabase-Umgebung (kein Supabase-CLI/Docker vorhanden, `.env` zeigt auf Produktion).

## 3. Zugriffskontrolle
- `listAdultInterests`, `updateAdultInterest`, `deleteAdultInterest` laufen mit Anmelde-Prüfung und `is_staff` (nur Rollen `admin` und `board`); Trainer und Mitglieder erhalten „Forbidden“. Der CSV-Export arbeitet mit den so geladenen Daten, hat also keinen eigenen Zugang.
- Zusätzlich blockiert die Datenbank (RLS, siehe oben). Die Seite `/admin/erwachsenenkurs` leitet Nicht-Berechtigte um.
- Öffentlich ist nur `submitAdultInterest` (schreibt, liest nichts zurück).

## 4. Preislogik bei späterer Buchung – wichtige Befunde
- Solange das Angebot `bookable = false` ist, lehnt `bookCourseTerm` jede Buchung ab, die Warteliste ist für dieses Angebot geschlossen. Die Interessenbekundung erzeugt weder Buchung noch Zahlung noch Mitgliedschaft; der erkannte Mitgliedsstatus wird nur zur Information gespeichert.
- **Bestehende Schwäche (nicht von mir verändert):** Die reguläre Buchung übernimmt die Angabe „Mitglied“ aus dem Formular (`isMember`), wenn das System keine Mitgliedschaft findet. Ein Nichtmitglied kann den Haken setzen und erhält den Mitgliederpreis; das ist nicht manipulationssicher. Vor Freigabe des Erwachsenenkurses sollte das auf „nur wenn aktive Mitgliedschaft gefunden“ umgestellt oder jede Selbstangabe manuell geprüft werden.
- **Buchungsformular ist kindbezogen:** Es verlangt Kind-Name/Geburtsdatum und Elternangaben. Für Erwachsene ist es so nicht passend. Die „verbindliche Anmeldung“ ist daher **nicht fertig vorbereitet**, sondern braucht eine eigene Anpassung (Entscheidung nötig).
- Preise liegen am Angebot (Kurs-Preis überschreibt Angebots-Preis) und werden serverseitig berechnet; der Client schickt keinen Preis.

## 5. Formular
- Gleiche Zod-Prüfung im Browser und auf dem Server; Pflichtfelder, E-Mail-Format, Längenbegrenzungen, Auswahlwerte als feste Liste, Einwilligung muss ausdrücklich `true` sein (nicht vorangekreuzt), Honeypot.
- Doppelte Einträge: gleiche E-Mail (klein geschrieben, getrimmt) je Angebot; Server prüft vorher und fängt Parallel-Klicks über den Index ab; der Person wird dasselbe Ergebnis gezeigt (keine Auskunft, ob die Adresse schon bekannt ist). Ein Doppelklick sperrt zusätzlich den Button.
- Grenzen: E-Mail-Aliasse (`+`) gelten als verschieden; gleiche Person mit anderer Adresse wird in der Verwaltung über Name/Telefon als „mögliche Doppelung“ markiert, nicht verhindert. Es gibt keine IP-Begrenzung gegen Massen-Einträge (wie bei der Warteliste nur Honeypot).

## 6. Änderungen an bestehenden Dateien
`nav-items.ts` (+2), `datenschutz.tsx`, `index.tsx` (Teaser, Karten ohne Erwachsenenkurs), `kurse.tsx` (Karte für das Angebot), `kurse_.$slug.tsx` (Weiche auf neue Seite, nur wenn nicht buchbar), `routeTree.gen.ts` (generiert, nur die neue Route ergänzt).
Unangetastet: `.env` (enthält eine fremde, nicht committbare Änderung `CRON_SECRET`), `docs/` (fremde Dateien).

## Nachtrag: Mitgliedspreis-Prüfung und Buchungsformular je Kursart
Migration `20261029130000_member_check.sql` (zusätzlich zu `…120000…`, beide lokal in PGlite doppelt eingespielt).
- **Regel:** Mitgliedspreis nur, wenn das System eine aktive Mitgliedschaft findet. Reine Selbstangabe „Mitglied“ → Normalpreis, `member_check = pending`, Anzeige in „Offene Zahlungen“ (Feld „Mitgliedschaft prüfen“) und auf der Startseite der Verwaltung. Bis zur Entscheidung gehen **keine Zahlungsmails** raus (Bestätigung ohne Zahlungsaufforderung, Cron-Erinnerung und manuelle Erinnerung sperren). Entscheidung per Knopf: Mitglied → Mitgliedspreis, kein Mitglied → Normalpreis; danach geht die Kursbestätigung mit Zahlungsaufforderung raus, das Zahlungsziel beginnt dann.
- Gilt für Direktbuchung, Warteliste (Eintrag: `member_claimed`, kein Vorrang für Unbestätigte) und Buchung aus der Warteliste. Admin-Zuteilungen (Vorstand entscheidet selbst) sind unverändert.
- **Buchungsformular je Kursart:** Angebote mit `min_age_years >= 18` zeigen `AdultBookingDialog` (Name, Kontakt, Rechnungsadresse, Volljährigkeit; keine Kind-/Gesundheitsangaben). Der Server erzwingt das passende Formular. Doppelbuchungen Erwachsener werden über E-Mail + Name abgefangen (die Datenbankprüfung braucht ein Geburtsdatum).
- **Bekannte Grenzen:** Angebots-Mail/-Seite der Warteliste zeigt für unbestätigte Mitglieder den Normalpreis; die Mail-Vorlage der „Mitgliedschaft wird geprüft“-Bestätigung wurde nicht visuell geprüft; Browser-Test steht aus (Migration nicht in Testumgebung eingespielt).
