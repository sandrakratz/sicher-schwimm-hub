# Entwurf: Atomare Buchung (Punkt 3) und eine einzige Warteliste (Punkt 4)

Stand: 2026-10-02 · Status: **Entwurf, nichts davon ist umgesetzt oder in der Datenbank eingespielt.**
Bezug: Prüfung des Buchungssystems vom 2026-10-02 (Punkte 3 und 4), PR #22 und #23 sind bereits gemergt.

## 1. Ausgangslage

### Punkt 3 – Doppel- und Überbuchung
Die Online-Buchung (`bookCourseTerm`, `src/lib/courses-public.functions.ts`) und die Zusage zu einem
Wartelisten-Angebot (`respondWaitlistOffer` → `bookWaitlistEntry`, `src/lib/waitlist-booking.server.ts`)
arbeiten nach dem Muster „lesen, entscheiden, schreiben“ in getrennten Abfragen ohne Sperre:

| Szenario | Folge |
|---|---|
| Zwei Familien buchen gleichzeitig den letzten Platz | beide werden `confirmed`, Kurs ist überbucht |
| Doppelklick oder zwei Tabs bei „Buchen“ | zwei Teilnehmer, zwei Anfragen, ggf. zwei Belegnummern |
| Doppelklick bei „Zusage“ zum Wartelisten-Angebot | zwei Teilnehmer (der Eintrag wird erst nach dem Insert auf `accepted` gesetzt) |
| Dasselbe Kind wird erneut gebucht | es gibt keinen Duplikatschutz. `UNIQUE (course_id, user_id)` greift nicht, weil `user_id` bei Online-Buchungen `NULL` ist |
| Insert schlägt nach `generate_course_document_no()` fehl | Lücke in der Belegnummern-Folge |

Alle Stellen, die `course_participants` anlegen:

1. `bookCourseTerm` (Online-Buchung)
2. `bookWaitlistEntry` (Zusage über Link und Direktbuchung durch den Vorstand)
3. `assignRequestToCourse` (Admin ordnet Anfrage einem Kurs zu)
4. `participant-transfer.functions.ts` (Umbuchung)
5. `addParticipant` in `src/routes/_authenticated/admin/kurse.tsx` (direkter Insert aus dem Browser)

### Punkt 4 – Zwei Wartelisten
- **Warteliste A** = Tabelle `waitlist_entries`. Nur sie wird von `allocateWaitlist` (Cron `waitlist-sweep`,
  Absage-Nachrücker) beachtet: Mitglieder zuerst, Mindestalter, „verfügbar ab“, Angebotsfrist.
- **Warteliste B** = `course_participants.status = 'waiting'`. Entsteht, wenn jemand einen vollen Kurs online bucht
  (`bookCourseTerm` Zeile ~382) oder wenn der Vorstand „Warteliste“ wählt. **Nie ein automatisches Angebot.**

Die Webseite und die Mail `course-waitlist-confirmation` versprechen B-Familien „sobald ein Platz frei wird, melden wir uns“.
Praktisch passiert nichts, solange niemand B von Hand durchgeht.
Die Wartelisten-Zähler auf der Webseite zählen nur A, die Admin-Kursübersicht zeigt B getrennt („Warteliste: N“).

## 2. Entwurf Punkt 3 – Buchung in einer Datenbank-Transaktion

### Idee
Eine Postgres-Funktion `book_course_seat(...)` erledigt Prüfen und Einfügen in **einer** Transaktion.
Die Kurszeile wird mit `SELECT ... FOR UPDATE` gesperrt, Buchungen für denselben Kurs laufen dadurch nacheinander.
Andere Kurse bleiben unberührt.

Reihenfolge in der Funktion:
1. Kurszeile sperren (`FOR UPDATE`).
2. Duplikat prüfen: gleiches Kind (Name normalisiert + Geburtsdatum) mit Status ≠ `cancelled` im selben Kurs → `duplicate`.
3. Belegte Plätze zählen: `confirmed` + laufende Wartelisten-Angebote (wie `freeSlots`), bei Zusage ohne das eigene Angebot.
4. Voll → Ergebnis `full` (die Funktion legt nichts an).
5. Belegnummer vergeben und Teilnehmer einfügen.
6. Bei Zusage zusätzlich im selben Schritt: `waitlist_entries` von `offered` → `accepted` setzen
   (`WHERE id = ... AND status = 'offered' AND offer_expires_at >= now()`). Trifft das keine Zeile → `offer_not_valid`, Rollback.
   Das ersetzt das heutige „erst buchen, dann Eintrag aktualisieren“ und macht den Doppelklick unschädlich.

Rückgabe: `jsonb` mit `result` (`booked` | `full` | `duplicate` | `offer_not_valid` | `course_not_found`), `participant_id`, `document_no`.

### Skizze (nicht lauffähig geprüft, nur zur Abstimmung)
```sql
create or replace function public.book_course_seat(
  p_course_id uuid,
  p_participant jsonb,          -- participant_name, date_of_birth, participant_email, ... (Spaltennamen)
  p_entry_id uuid default null  -- Wartelisteneintrag, dessen Angebot eingelöst wird
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_course public.courses%rowtype;
  v_taken int;
  v_dup uuid;
  v_id uuid;
  v_doc text;
begin
  select * into v_course from public.courses where id = p_course_id for update;
  if not found then return jsonb_build_object('result', 'course_not_found'); end if;

  select id into v_dup from public.course_participants
   where course_id = p_course_id and status <> 'cancelled'
     and lower(btrim(participant_name)) = lower(btrim(p_participant->>'participant_name'))
     and date_of_birth = (p_participant->>'date_of_birth')::date
   limit 1;
  if v_dup is not null then
    return jsonb_build_object('result', 'duplicate', 'participant_id', v_dup);
  end if;

  select (select count(*) from public.course_participants
           where course_id = p_course_id and status = 'confirmed')
       + (select count(*) from public.waitlist_entries
           where offer_course_id = p_course_id and status = 'offered'
             and offer_expires_at >= now()
             and (p_entry_id is null or id <> p_entry_id))
    into v_taken;

  if v_course.max_participants is not null and v_taken >= v_course.max_participants then
    return jsonb_build_object('result', 'full');
  end if;

  if p_entry_id is not null then
    update public.waitlist_entries
       set status = 'accepted', offer_token = null, responded_at = now()
     where id = p_entry_id and status = 'offered' and offer_expires_at >= now();
    if not found then return jsonb_build_object('result', 'offer_not_valid'); end if;
  end if;

  v_doc := public.generate_course_document_no();
  insert into public.course_participants (course_id, status, document_no, document_issued_at /* , weitere Spalten explizit */)
  values (p_course_id, 'confirmed', v_doc, now() /* , ... */)
  returning id into v_id;

  return jsonb_build_object('result', 'booked', 'participant_id', v_id, 'document_no', v_doc);
end $$;

revoke all on function public.book_course_seat(uuid, jsonb, uuid) from public;
grant execute on function public.book_course_seat(uuid, jsonb, uuid) to service_role;
```

### Anpassungen im Code
- `bookCourseTerm`: Sperrliste, Alter, Mitgliedspreis und Zahlungsbedingungen bleiben in TypeScript.
  Statt `freeSlots` + `insert` wird `book_course_seat` aufgerufen. `duplicate` → freundliche Meldung („Für dieses Kind liegt bereits eine Buchung vor“),
  `full` → Verhalten aus Punkt 4.
- `bookWaitlistEntry`: ruft die Funktion mit `p_entry_id` auf. Das nachträgliche `update waitlist_entries ... accepted` entfällt.
- Mails und Anfrage-Datensatz erst **nach** erfolgreicher Buchung anlegen (heute entsteht die Anfrage zuerst und bleibt bei einem Fehler als Waise zurück).
- Fehler beim Anlegen der Anfrage wird geprüft; Idempotenz-Schlüssel der Mails hängen an der Teilnehmer-ID statt an `request?.id ?? course.id`.

### Absicherung zusätzlich zur Funktion
Teilweiser eindeutiger Index als Gürtel zum Hosenträger:
```sql
create unique index course_participants_one_active_child_per_course
  on public.course_participants (course_id, lower(btrim(participant_name)), date_of_birth)
  where status <> 'cancelled' and date_of_birth is not null;
```
**Vorher prüfen**, ob es schon Dubletten gibt (Abfrage in Abschnitt 5), sonst schlägt das Anlegen fehl.

### Bewusst nicht Teil von Schritt 1
- Admin-Wege (3–5 oben): der Vorstand darf weiterhin bewusst überbuchen. Später kann `assignRequestToCourse` dieselbe Funktion nutzen.
- Der direkte Insert aus dem Browser (`addParticipant`) bleibt, bis geklärt ist, ob er auf eine Server-Funktion umgestellt werden soll.

## 3. Entwurf Punkt 4 – Eine Warteliste

### Empfehlung (Variante A)
`waitlist_entries` wird die **einzige** Warteliste.
- Online-Buchung in einem vollen Kurs: kein Teilnehmer mit Status `waiting`, sondern ein Wartelisteneintrag
  (`program_id`, `course_id`, `request_id`, Kinddaten, Gesundheitsangaben in `notes`, Mitgliedsstatus).
  Die Familie bekommt die bestehende Mail `waitlist-signup` (Text ggf. leicht anpassen) und steht in der normalen Reihenfolge
  (Mitglieder zuerst, dann nach Eingang) – inklusive aller Prüfungen aus `allocateWaitlist`.
- Die Eltern erhalten damit wirklich ein Angebot, sobald ein Platz frei wird.
- Zähler auf der Webseite und im Admin stimmen automatisch, weil es nur noch eine Quelle gibt.
- Admin: `assignRequestToCourse` mit Status „Warteliste“ und die Auswahl „Warteliste“ in `addParticipant` führen auf die
  Warteliste (vorhanden: `moveParticipantToWaitlist` in `course-assignment.functions.ts`). `course_participants.status = 'waiting'`
  bleibt im Enum, wird aber nicht mehr neu angelegt.

### Alternative (Variante B), nicht empfohlen
`allocateWaitlist` liest zusätzlich `course_participants` mit Status `waiting`.
Zwei Quellen müssten dauerhaft abgeglichen werden (Reihenfolge, Mitgliederbevorzugung, Absagen, Löschungen); das Fehlerrisiko bleibt.

### Umgang mit Bestandsdaten
Es gibt vermutlich Familien, die heute als `waiting` Teilnehmer stehen und nie ein Angebot bekommen.
Vorgehen: erst nur auflisten (Abschnitt 5), dann gemeinsam entscheiden:
übernehmen in `waitlist_entries` (mit `request_id`, damit keine Dubletten entstehen) und den Teilnehmer auf `cancelled` setzen,
oder gezielt von Hand anschreiben. **Keine automatische Massenänderung ohne Freigabe.**

### Passend dazu (kleine Folgeänderung zu PR #23)
`moveParticipantToWaitlist` (Zeile ~392) und `course-lifecycle.functions.ts` (Zeile ~115) löschen weiterhin `offer_course_id`.
Wer aus einem Kurs auf die Warteliste zurückgesetzt wird, soll denselben Kurs nicht sofort wieder automatisch angeboten bekommen:
dort `offer_course_id` auf den verlassenen Kurs setzen statt auf `null`.

## 4. Reihenfolge der Umsetzung

1. **Diagnose** (nur lesen): Abfragen aus Abschnitt 5 im Supabase-SQL-Editor ausführen.
2. **Migration 1**: Funktion `book_course_seat` anlegen (wirkt noch nirgends, alter Code läuft unverändert weiter).
3. **Code**: `bookCourseTerm` und `bookWaitlistEntry` auf die Funktion umstellen, Variante A für „voller Kurs“. → ein PR.
4. **Bereinigung** der Bestandsdaten nach Freigabe (Dubletten, `waiting`-Teilnehmer).
5. **Migration 2**: eindeutiger Index (erst nach der Bereinigung).
6. **Folgeänderung** `offer_course_id` bei Rücksetzen auf die Warteliste.

Migrationen spielst du selbst ein (siehe Projekt-Notizen); ich liefere die SQL-Dateien unter `supabase/migrations/`.

## 5. Diagnose-Abfragen (nur lesend)

```sql
-- A) Überbuchte Kurse
select c.id, c.name, c.max_participants,
       count(*) filter (where p.status = 'confirmed') as confirmed
  from courses c left join course_participants p on p.course_id = c.id
 where c.archived_at is null and c.max_participants is not null
 group by c.id having count(*) filter (where p.status = 'confirmed') > c.max_participants;

-- B) Doppelte aktive Teilnehmer im selben Kurs (Blocker für den eindeutigen Index)
select course_id, lower(btrim(participant_name)) as kind, date_of_birth, count(*) as anzahl,
       array_agg(id) as teilnehmer_ids
  from course_participants
 where status <> 'cancelled' and date_of_birth is not null
 group by 1, 2, 3 having count(*) > 1;

-- C) Familien auf der „zweiten“ Warteliste (Teilnehmer mit Status waiting)
select p.id, c.name as kurs, p.participant_name, p.participant_email, p.date_of_birth,
       p.online_booking, p.created_at
  from course_participants p join courses c on c.id = p.course_id
 where p.status = 'waiting' and c.archived_at is null
 order by p.created_at;

-- D) Lücken in der Belegnummern-Folge (Hinweis auf fehlgeschlagene Inserts)
select document_no from course_participants
 where document_no like 'SK-2026-%' order by document_no;
```

## 6. Risiken und Grenzen
- Die Sperre pro Kurs serialisiert Buchungen eines Kurses. Bei der Größe des Vereins unkritisch.
- Postgres-Sequenzen sind nicht transaktional: Lücken bei Belegnummern können nach einem Rollback weiter entstehen,
  werden aber selten, weil die Nummer erst nach allen Prüfungen vergeben wird.
- Es gibt kein Testsystem außer der Produktionsdatenbank. Für die Parallel-Prüfung (z. B. 20 gleichzeitige Aufrufe auf einen Kurs mit
  1 freiem Platz, erwartet: genau 1 × `booked`) braucht es einen nicht öffentlichen Testkurs oder eine lokale Supabase-Instanz.
- Die Funktion legt Spalten explizit fest; neue Spalten in `course_participants` müssen dort nachgezogen werden.

## 7. Entscheidungen (2026-10-02)
1. **Variante A** (eine Warteliste): ja.
2. **Bestehende „waiting“-Teilnehmer:** gehen auf die Warteliste und warten, bis ein **neuer** Kurs startet
   (`available_from` = Tag nach dem aktuell letzten Kursstart des Angebots; Skript `docs/bereinigung-warteliste-teilnehmer.sql`).
   Einträge mit eingetragenem „verfügbar ab“-Datum werden anhand des **Kursstarts** verglichen
   (`course.starts_on >= available_from`, bereits so in `allocateWaitlist`).
3. **Vorstand darf überbuchen:** ja (`p_source = 'admin'`).
4. **Duplikat (gleicher Name + Geburtsdatum im selben Kurs):** blockieren.

## 8. Umsetzungsstand
- Umgesetzt (PR „Atomare Buchung“): Funktion `book_course_seat`, `bookCourseTerm`, `bookWaitlistEntry`/`respondWaitlistOffer`,
  Online-Buchung im vollen Kurs → `waitlist_entries`.
- **Noch offen (Folge-PR):** Vorstand-Wege `assignRequestToCourse` mit Status „Warteliste“ und `addParticipant`
  („Warteliste“-Auswahl) auf die Warteliste umleiten; `offer_course_id` beim Zurücksetzen auf die Warteliste setzen;
  eindeutiger Index (erst nach Abfrage B und Bereinigung).
