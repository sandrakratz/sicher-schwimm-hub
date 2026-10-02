# Prüfbericht Verwaltungs- und Trainerbereich (2026-10-02)

**Umfang:** alle Seiten unter `src/routes/_authenticated/admin` und `/trainer`, die zugehörigen Komponenten (`components/admin`, `components/trainer`, `AttendanceBoard`, `TrainerAttendancePanel`), alle Server-Funktionen in `src/lib/*.functions.ts` / `*.server.ts`, die Cron-Hooks und die Datenbank-Regeln (Migrationen).

**Methode:** Quelltext gelesen, `tsc --noEmit` (0 Fehler) und ESLint (nur 20× `react-hooks/exhaustive-deps`, keine echten Fehler) laufen lassen. **Nicht geprüft:** Produktionsdaten (kein Datenbankzugriff), kein Klicktest im laufenden System. Aussagen wie „ab 1000 Zeilen“ sind aus dem Code abgeleitet; ob die Grenze heute schon erreicht ist, kann nur ein Blick in die Datenbank zeigen. Es wurde nichts geändert.

Stufen: **Hoch** = falsche Ergebnisse, Datenverlust oder Regelverstoß möglich · **Mittel** = Fehlfunktion oder Lücke, aber mit Umweg · **Niedrig** = Schönheit, Randfall.

---

## HOCH

### H1 Sperrliste wird umgangen: gesperrte Familien landen automatisch auf der Warteliste und bekommen Angebote
- Eine gesperrte Online-Buchung legt eine Kursanfrage mit Status `new` an (`src/lib/courses-public.functions.ts:271-286`).
- Sobald jemand die Wartelisten-Seite öffnet, läuft `migrateWaitingRequests` automatisch (`src/components/admin/WaitlistAdmin.tsx:419-425`). Die Funktion importiert **jede** Anfrage ohne Kurszuweisung, die nicht „abgelehnt“ ist (`src/lib/waitlist.functions.ts:642-649`). Der Kommentar sagt „Status Warteliste“, der Code prüft das nicht.
- `allocateWaitlist` prüft die Sperrliste nie (`src/lib/waitlist.server.ts:161-232`), die stündliche Vergabe schickt also Platzangebote an Gesperrte.
- **Folge:** Familien, die wegen Nichtzahlung gesperrt sind, bekommen trotzdem Plätze angeboten. Die „Einzelfallprüfung“ ist ausgehebelt.
- **Vorschlag:** Import nur für Status `waiting_list` und mit Sperrlistenprüfung; Vergabe überspringt Einträge mit Treffer in `isBlocked`.

### H2 Platzangebot wird gesetzt, auch wenn die E-Mail nie ankommt, und zählt später als Absage
- `createOffer` setzt den Eintrag auf „angeboten“ und ignoriert, ob die Mail verschickt wurde (`src/lib/waitlist.server.ts:113-152`). `queueTemplateEmail` liefert bei unterdrückter Adresse (Bounce/Abmeldung), Fehler oder erreichtem Resend-Tageslimit `queued: false` (`src/lib/email-send.server.ts:87-117`).
- Der Platz bleibt dann bis zum Fristende reserviert. Danach wird das als Absage gezählt (`expireOffers`, `waitlist.server.ts:24-54`). Nach drei Mal wird die Familie **deaktiviert**, ohne je etwas gesehen zu haben.
- Das Free-Limit von 100 Mails/Tag wird durch Eilnachrichten, Erinnerungen und den ungeschützten Kontakt-Endpunkt (siehe Datenschutzbericht Punkt 7) leicht erreicht.
- **Vorschlag:** Wenn die Mail nicht rausgeht, Angebot zurückrollen (Status `waiting`) und den Vorstand informieren.

### H3 „Kurs absagen“ lässt laufende Platzangebote für diesen Kurs gültig
- `cancelCourse` verschiebt nur Teilnehmer (`src/lib/course-lifecycle.functions.ts:93-156`). Wartelisten-Einträge mit Status `offered` und `offer_course_id = abgesagter Kurs` bleiben aktiv.
- `book_course_seat` prüft nur, ob der Kurs existiert, nicht Status, `is_public` oder Archiv (`supabase/migrations/20261002130000_book_course_seat.sql`, Schritt 1). Wer den Link in der Angebotsmail anklickt, kann in den abgesagten Kurs buchen und bekommt Rechnung samt Zahlungsaufforderung (`waitlist.functions.ts:231-259`).
- Läuft das Angebot ab, zählt es zusätzlich als Absage (siehe H2).
- **Vorschlag:** In `cancelCourse` offene Angebote dieses Kurses auf `waiting` zurücksetzen (ohne Absagezähler); in `book_course_seat` archivierte/abgeschlossene Kurse ablehnen.

### H4 „Kurs löschen“ vernichtet alle Buchungen, Zahlungen und Rechnungsnummern des Kurses
- `remove(c)` löscht den Kurs nach einer einzigen Rückfrage (`src/routes/_authenticated/admin/kurse.tsx:1001-1006`). `course_participants.course_id` hat `ON DELETE CASCADE` (`supabase/migrations/20260604095920…sql:139`). Der Menüpunkt steht direkt unter „Archivieren“ (`kurse.tsx:1084-1087`).
- Buchungsbelege müssen aus steuerlichen Gründen aufbewahrt werden.
- Gleiches Muster beim Löschen eines Kursangebots (`kurse.tsx:663-668`).
- **Vorschlag:** Löschen nur erlauben, wenn keine Teilnehmer existieren; sonst nur Archivieren anbieten.

### H5 „Einbuchen“ aus der Kursanfrage verschluckt den Duplikatfehler, verbraucht eine Rechnungsnummer und verschickt trotzdem die Bestätigung
- `assignRequestToCourse` erzeugt zuerst die Belegnummer (`src/lib/course-assignment.functions.ts:196-198`) und ignoriert dann jeden Fehler, der „duplicate“ enthält (`:264-266`). Der seit PR #26 vorhandene Unique-Index meldet genau so einen Fehler.
- Danach wird die Anfrage auf „akzeptiert“ gesetzt, die Bestätigungsmail und ggf. die Sofortzahlungs-Warnung gehen raus, obwohl kein Teilnehmer angelegt wurde. Die Nummer fehlt in der Reihenfolge.
- **Vorschlag:** Duplikat als klare Fehlermeldung zurückgeben (wie in `transferParticipant`, `participant-transfer.functions.ts:110-114`) und Nummern erst nach erfolgreichem Insert ziehen (wie in `book_course_seat`).

### H6 Steuer-Teilnehmerliste: falsche Spalte und falsche Summen
- Spalte „Kontakt / Eltern“ enthält den Namen des **Kindes** (`src/lib/course-sessions.functions.ts:462`, identisch zu Spalte „Name des Kindes“ in `:459`). Der Elternname (aus `course_requests.parent_name`) wird nicht geladen.
- Die Liste enthält auch stornierte und wartende Einträge (`:358-363`), die Summen „Gesamt / bezahlt / offen“ rechnen alle mit (`:478-500`). Storniert-und-unbezahlt zählt als „offen“, die Anzahl in „Summe (N Teilnehmer)“ ist zu hoch.
- **Vorschlag:** Elternname laden; Summen nur über Status `confirmed`.

### H7 Trainer-Jahresnachweis (Übungsleiterpauschale): nur das laufende Jahr, und ggf. leer ohne Fehlermeldung
- Der Button erzeugt immer `new Date().getFullYear()` (`kurse.tsx:425, 1129`). Ab 1. Januar kann der Nachweis fürs Vorjahr nicht mehr erstellt werden, obwohl der Server jedes Jahr 2020–2100 kann.
- `generateTrainerProofXlsx` lädt Anwesenheiten mit einer `.in("session_id", …)`-Liste **aller** Termine des Jahres (`course-sessions.functions.ts:824-829`) und prüft den Fehler nicht. Bei einer langen Liste (siehe M7) scheitert die Abfrage vermutlich, die Datei enthält dann „Für dieses Jahr wurden noch keine Trainer-Anwesenheiten erfasst“.
- **Vorschlag:** Jahresauswahl im Dialog; Abfrage in Blöcken oder über einen Datums-Join; Fehler ausgeben.

### H8 Zeitbombe: stille 1000-Zeilen-Grenze der Datenbank-Abfragen
Supabase liefert pro Abfrage höchstens 1000 Zeilen, `.limit(2000)` ändert daran nichts. Folgende Stellen laden „alles“ und werden ab 1000 Zeilen **still falsch**:

| Stelle | Folge |
|---|---|
| `calendar.functions.ts:62-77` (alle Termine aufsteigend, alle Profile) | Kurskalender/Dienstplan verliert die **neuesten** Termine; Trainernamen werden „Unbekannt“ |
| `admin-dashboard.functions.ts:66` (alle Dienstplan-Zuordnungen) | „Termine ohne Trainer“ zu hoch |
| `kurse.tsx:571, 596` (alle Teilnehmer / Termine) | Belegung, „X offen“, „überfällig“ je Kurs falsch |
| `waitlist.functions.ts:298, 340-347, 352-356` (alle Einträge, alle Buchungen) | neueste Wartelisteneinträge fehlen; Zahlungsstatus in der Warteliste falsch |
| `trainer/index.tsx:52-55`, `trainer-courses.functions.ts:60-62` (alle Termine) | Trainer sehen eigene Kurse/Einsätze nicht mehr |
| `emails.tsx:85-89` | „30 Tage“/„Alle“ zeigen nur die neuesten 1000 Mails, Statistik falsch |

**Vorschlag:** Abfragen nach Datum/Kurs einschränken (z. B. Termine ab heute minus 30 Tage) oder seitenweise laden.

---

## MITTEL

### Rechte und Sicherheit
- **M1 Vorstand kann sich zum Administrator machen und Admins entrechten.** `setUserRole` prüft nur „Vorstand oder Admin“ (`admin-users.functions.ts:20-27, 91-132`). Kein Schutz davor, die eigene Admin-Rolle oder die letzte Admin-Rolle zu entziehen. Außerdem zeigt die Oberfläche „Benutzer löschen“ auch für Vorstand, der Server lehnt es mit „Nur Administratoren erlaubt“ ab (`benutzer.tsx:249`, `admin-users.functions.ts:29-35`).
- **M2 Cron-Endpunkte sind durch den öffentlichen Supabase-Schlüssel „geschützt“.** Alle sechs Hooks unter `src/routes/api/public/hooks/` vergleichen den `apikey`-Header mit `SUPABASE_PUBLISHABLE_KEY`, der in `wrangler.jsonc` und im Browser-Bundle steht. Jeder kann Sweep, Erinnerungen und Zeugnisversand anstoßen (Mails idempotent, aber Mail-Kontingent und Last). **Vorschlag:** eigenes Geheimnis `CRON_SECRET`.
- **M3 Trainer dürfen per Datenbank mehr als die Oberfläche zeigt.** RLS „Trainers update own course enrollments“ erlaubt das Ändern **aller** Spalten (`paid`, `price_amount`, `status`, …) von Teilnehmern der eigenen Kurse, und Lesen von Adresse/Preis/internen Notizen (`supabase/migrations/20260826154645…sql:9-20`). `listMyTrainerCourses` reduziert Zahlungsdaten bewusst, die Datenbank tut es nicht. Dazu kommt: Trainer dürfen die Exporte Steuerliste, Kursbestätigungen und MeinVerein-CSV erzeugen (`course-sessions.functions.ts:15-19, 344-348, 554-558, 664-668`; Menü ungeschützt in `kurse.tsx:1074-1079`).
- **M4 Trainer sehen alle aktiven Mitglieder mit Telefon, E-Mail, Geburtsdatum** (`members-list.functions.ts:40-51`). Datensparsamkeit prüfen.
- **M5 `syncHelperGroupFill` hat keine Rollenprüfung** (`event-helpers.functions.ts:86-90`), jedes angemeldete Konto kann es auslösen. Wirkung harmlos (berechnet nur), aber unnötig offen.
- **M6 CSV-Formeln:** Exporte als CSV (`widerrufe.tsx:98-112`, `course-sessions.functions.ts:741-777`) schreiben Texte aus öffentlichen Formularen ungeprüft. Beginnt ein Name oder eine Bemerkung mit `=`, `+`, `-` oder `@`, führt Excel die Zelle als Formel aus.

### Kursverwaltung
- **M7 Zu lange `.in()`-Listen:** `AvailabilityBoard.tsx:76-86`, `OpenAvailabilityNotice.tsx:36-41`, `waitlist.functions.ts:317-323`, `course-sessions.functions.ts:824-829` übergeben alle IDs in der URL. Ab einigen hundert IDs ist die URL zu lang (typisch 8–16 KB), die Abfrage schlägt fehl und der Code behandelt das als „keine Daten“ (Trainer sehen ihre Zusagen nicht mehr, Warteliste ohne Wunschkurs). `kurse.tsx:600` macht es richtig (Blöcke à 200).
- **M8 Status „Warteliste“ bei Teilnehmern ist noch möglich** und verwaist das Kind:
  - „Teilnehmer hinzufügen“ mit Status „Warteliste“ **und** gewähltem Wartelisteneintrag legt einen Teilnehmer mit Status `waiting` an und setzt den Wartelisteneintrag auf „gebucht“ (`kurse.tsx:749-790`).
  - Im Bearbeiten-Dialog kann der Status auf „Warteliste“ gestellt und direkt gespeichert werden (`kurse.tsx:1738-1740, 876-894`).
  - Solche Kinder stehen in keiner Warteliste (nur `waitlist_entries` wird automatisch vergeben) und bekommen nie ein Angebot.
- **M9 Speichern im Teilnehmer-Dialog überschreibt „bezahlt von“:** `savePart` setzt `paid_by`/`member_confirmed_by` bei jedem Speichern auf die gerade angemeldete Person (`kurse.tsx:884-891`). Wer Telefon oder Notiz ändert, wird als der eingetragen, der die Zahlung bestätigt hat.
- **M10 Termin löschen ohne Rückfrage:** `removeSession` (`kurse.tsx:395-399`, Button `:1867`) löscht per Klick den Termin samt Anwesenheit und Trainer-Nachweis (Cascade). Termine ändern oder hinzufügen aktualisiert `starts_on`/`ends_on` nicht (`:367-394`), nur der Import tut das; Zahlungsfristen und Erinnerungen hängen am Kursstart.
- **M11 Excel-Kursliste kennt nur 10 Termine** (`course-sessions.functions.ts:134-137, 155-159, 232-235, 249-253`); die Oberfläche erlaubt bis 30. Ab dem 11. Termin fehlen Spalten und Anwesenheiten, auch im Trainer-Block.
- **M12 Kurs verschieben:** Termine werden ohne Fehlerprüfung einzeln geändert (`course-lifecycle.functions.ts:37-42`), die Pausen (`session_breaks`) bleiben auf den alten Daten; Eltern mit zwei Kindern erhalten zwei Mails (kein Zusammenfassen wie bei der Eilnachricht).
- **M13 Kurs absagen:** Der Eintrag auf die Warteliste und das Löschen des Platzes werden nicht auf Fehler geprüft (`course-lifecycle.functions.ts:113-139`). Scheitert das Einfügen (z. B. fehlende Pflichtangabe), ist das Kind aus dem Kurs raus und steht nirgends. Der Kurs bekommt Status „Abgeschlossen“ statt „abgesagt“ und das Dashboard zählt seine Termine weiter als „ohne Trainer“ (`admin-dashboard.functions.ts:61-72`).
- **M14 Umbuchung ist nicht atomar:** Wird nach dem Anlegen der neuen Buchung das Beenden der alten abgelehnt, ist das Kind doppelt gebucht (`participant-transfer.functions.ts:93-120`). Die neue Buchung hat keine Belegnummer (Preis = Restbetrag).
- **M15 Teilnehmer entfernen:** Der Sperrlisteneintrag wird nicht auf Fehler geprüft, die Oberfläche meldet trotzdem „auf die Sperrliste gesetzt“ (`participants-admin.functions.ts:44-52`; ebenso `waitlist.functions.ts:613-625`). Die zugehörige Kursanfrage bleibt „akzeptiert“ mit Kurs, und der frei gewordene Platz wird nicht sofort vergeben (`unassignRequestFromCourse` tut beides).
- **M16 `moveParticipantToWaitlist` lädt die komplette Warteliste ohne Filter** (`course-assignment.functions.ts:407-409`) und findet Dubletten nur in den ersten 1000 Einträgen.

### Warteliste und Posteingang
- **M17 „Mögliche Dublette“ erscheint nie:** Die Oberfläche liest `duplicate_of` (`WaitlistAdmin.tsx:720`), der Server liefert `duplicate` (`waitlist.functions.ts:398`).
- **M18 Posteingang und Dashboard führen auf die falsche Seite:** „Kursanfrage → Vorgang öffnen“, Dashboard „Neue Kursanfragen“ und Posteingang zeigen auf `/admin/warteliste`, geöffnet wird der Reiter „Warteliste“. Die Anfrage liegt aber unter „Frühere Kursanfragen“ (`inbox.functions.ts:84`, `admin-dashboard.functions.ts:99-103`, `warteliste.tsx:17-24`). Außerdem listet der Posteingang die **komplette aktive Warteliste** (bis 100) als „offene Vorgänge“ (`inbox.functions.ts:61-66`); „ungelesen“ steht nur im lokalen Browserspeicher (nicht geteilt zwischen Vorstandsmitgliedern).
- **M19 Warteliste: „Direkt buchen/anbieten“ blendet volle Kurse aus** (`WaitlistAdmin.tsx:686-689`), obwohl der Vorstand laut Regeln überbuchen darf. Erfolgs-Meldungen erscheinen vor dem Ergebnis (`:780-783, 924`); schlägt die Aktion fehl, sieht man „gespeichert“ und „fehlgeschlagen“ nacheinander.
- **M20 `ilike` mit E-Mail-Adressen:** Unterstrich in Adressen wirkt als Platzhalter. Öffentliche Buchung escaped das (`courses-public.functions.ts:461`), diese Stellen nicht: `waitlist.functions.ts:43-44`, `course-assignment.functions.ts:64, 165`, `push.functions.ts:50`, `conversation.server.ts:74`, `account-activation.server.ts:30`. Selten, aber falsche Treffer (z. B. Eltern-Konto der falschen Familie).
- **M21 Fälligkeitsdatum als UTC-Datum gespeichert:** `terms.dueDate.toISOString().slice(0, 10)` (`waitlist-booking.server.ts:66`, `course-assignment.functions.ts:205`, `courses-public.functions.ts:412`). Bei Buchungen zwischen 0 und 2 Uhr Berliner Zeit ist das gespeicherte Datum einen Tag früher als das in der Mail genannte.

### Trainerbereich
- **M22 „Kind umbuchen“ ist für Trainer sichtbar, funktioniert aber nicht:** Button in `trainer/kurse.tsx:197-204`; `listTransferTargets` und `previewTransfer` verlangen Vorstand (`participant-transfer.functions.ts:6-9, 163-166`), der Kommentar dort sagt „auch für Trainer:innen“. Ergebnis: „Forbidden“-Meldung. Entweder Button für Trainer ausblenden oder als Anfrage an den Vorstand umbauen.
- **M23 Trainer-Startseite zeigt andere Einsätze als „Meine Kurse“:** Startseite nutzt nur Termin-Zuordnungen (`trainer/index.tsx:46-58`), „Meine Kurse“ zusätzlich `courses.trainer_id` (`trainer-courses.functions.ts:54-76`). Dazu drei weitere Definitionen von „besetzt“ (Kalender, Dienstplan-Matrix, Dashboard, Verfügbarkeit). „Heute“ ist UTC statt Berlin (`index.tsx:73`, ebenso `AttendanceBoard.tsx:156`, `OpenAvailabilityNotice.tsx:26`).
- **M24 Trainer-Kalender-Export nutzt die Elternzeiten statt der internen Terminzeiten** (`AvailabilityBoard.tsx:180-198`, `parseTimeRange(schedule)`); die Termin-Zeiten `start_time`/`end_time` werden nicht geladen.
- **M25 „Dienstplan“-Link in `/admin/kurse` führt Trainer ins Leere** (Kalender nur für Vorstand, Weiterleitung auf die Mitgliederliste; `kurse.tsx:1059, 1065`).
- **M26 Prüfungsprotokoll nennt immer „Michael Kratz“ als Prüfer** (`trainer-courses.functions.ts:431-437`, `void me`), auch wenn andere Personen die Teilleistungen abgenommen haben.
- **M27 Eingaben nicht geprüft:** `updateParticipantResult` prüft Datum, Länge von Abzeichen/Anmerkung und Stufe nicht (`trainer-courses.functions.ts:294-298`); `updateParticipantPhone` stürzt bei fehlendem Feld ab und schreibt die Nummer in den Audit-Log (`:159-173, 233`).

### E-Mail
- **M28 „Gesendete E-Mails“ lädt bis zu 1000 komplette Mails** inklusive HTML/Text auf einmal (`emails.tsx:85-89`, `select("*")`); das sind schnell mehrere MB. Nur Spalten für die Liste laden und den Inhalt erst beim Öffnen holen. Nach „Testversand“ aktualisiert sich die Liste nicht (`onDone={() => setRange(r => r)}`, `emails.tsx:166`). Der Testversand schickt 6 Vorlagen × bis zu 3 Adressen = **18 echte Mails pro Klick** in das 100er-Tageskontingent. „Inhalte rekonstruieren“ ist für Vorstand sichtbar, der Server erlaubt nur Admin (`email-backfill.functions.ts:43-44`); die rekonstruierten Texte sind Schätzungen („nächstliegende Anfrage“).
- **M29 „Versandstatus“ zählt nur die letzten 100 Ereignisse** (`versandstatus.tsx:83`, `email-logs.functions.ts:36`); Kennzahlen und „30 Tage“ sind dadurch irreführend.
- **M30 Eilnachricht-Vorlage „Nachholtermin“ enthält den Platzhalter `[Datum, Uhrzeit]`** (`CourseBroadcastDialog.tsx:16`) und wird ohne Prüfung gesendet; ebenso „(bzw. wegen zu geringer Wassertemperatur)“ in „Bad geschlossen“ (`:15`).

### Weitere
- **M31 Audit-Log ist kaum verwertbar:** zeigt nur Aktion, Objektart und Zeit, nicht **wer** und **was** (Akteur, Objekt-ID und Details werden gespeichert, aber nicht angezeigt), nur die letzten 100 (`audit.tsx:18-35`).
- **M32 Hochgeladene Bilder/Dateien bleiben nach Löschen/Ersetzen im Speicher.** Der Kommentar in `MediaUploadField.tsx:37, 45` verspricht Löschen beim Speichern, `news.tsx:70-101`, `events.tsx:107-136` und `dokumente.tsx:65-110` tun das nicht. Datenschutz (Fotos) und Speicherplatz.
- **M33 Helfer-Zählung uneinheitlich:** Kalender zählt Zusagen-Zeilen (`calendar.functions.ts:153`), Helfer-Dialog ebenfalls (`HelperGroupsPanel.tsx:125`), die automatische „besetzt“-Markierung zählt verschiedene Personen (`event-helpers.functions.ts:101-104`). Hat jemand zwei Zeitfenster, stimmen die Anzeigen nicht überein.

---

## NIEDRIG
- `suche.tsx:44-86`: Suchergebnisse veralteter Anfragen können neuere überschreiben; Datenbankfehler zeigen „Keine Treffer“; Anführungszeichen im Suchbegriff werden nicht entfernt (`clean`, Zeile 35).
- `zahlungen.tsx:71-85`: „Bezahlt“ ohne Rückfrage und ohne „Rückgängig“.
- `CourseRequestsAdmin.tsx:569`: Geburtsdatum unformatiert (ISO). `suggestFn` bekommt die Anfrage-ID nicht mit (`:188`), die feste Verknüpfung wird dadurch nicht genutzt.
- `events.tsx:66-79`: Datum/Uhrzeit mit Browser-Zeitzone statt Berlin (an anderer Stelle `toBerlinInput`).
- `HelperGroupsPanel.tsx:150-157`: jede Fokusänderung eines Zeitfelds speichert und lädt neu.
- `ParticipantResultEditor.tsx:29`, `kurse.tsx:371, 531`: „heute“ als UTC-Datum.
- `kurse.tsx:205, 538-545`: `canManage` startet mit `true`; schlägt die Rollenabfrage fehl, sieht ein Trainer die Vorstands-Schaltflächen (Server verweigert dann).
- `waitlist.server.ts` / `waitlist-booking.server.ts`: nach erfolgreicher Buchung laufen weitere Schritte (Anfrage, Mails) ohne Fehlerbehandlung; wirft dort etwas, erhält der Nutzer eine Fehlermeldung, obwohl gebucht ist.
- 20 Hinweise `react-hooks/exhaustive-deps` (Liste per `eslint` reproduzierbar); überwiegend gewollt (Laden beim Öffnen), prüfenswert: `CourseRequestsAdmin.tsx:199`, `TransferParticipantDialog.tsx:51`, `trainer/kurse.tsx:78`.
- ESLint/Prettier meldet fast alle Dateien wegen Windows-Zeilenenden (`␍`); ein Prettier-Lauf mit `endOfLine: "auto"` würde das beheben.

---

## Was in Ordnung ist
- Typprüfung fehlerfrei; keine fehlenden Importe, keine toten Routen außer den beiden bewussten Weiterleitungen (`admin/anfragen`, `admin/verfuegbarkeit`).
- Jede Server-Funktion prüft die Rolle serverseitig (Ausnahme M5); die Seiten-Weiterleitungen sind nur Komfort.
- Antwort-Mails escapen Nutzertext, E-Mail-Vorschau im Admin läuft in `sandbox=""`-iframes, Token-Seiten (Zustimmung, Volljährigkeit, Angebot) sind einmalig und mit langen Zufallswerten abgesichert.
- Buchung läuft atomar über `book_course_seat`, der Unique-Index schützt vor doppelten Kindern.
