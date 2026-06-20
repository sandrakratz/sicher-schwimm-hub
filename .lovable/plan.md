
## Ziel
Vollständige Widerrufs-Lösung für Eltern, um zugeteilte/gebuchte Schwimmkurse rechtssicher zu widerrufen — Frontend-Seite, Backend-Funktionen, DB-Tabelle, E-Mail-Versand und Admin-Verwaltung.

## 1. Datenbank (Migration)

Neue Tabelle `public.cancellation_requests`:
- `reference_number` (text, unique) — Format `SW-WID-YYYYMMDD-XXXXX`
- `parent_first_name`, `parent_last_name`, `email`, `phone`
- `child_name`, `course_name`, `booking_date` (date)
- `notes` (nullable), `revocation_text`
- `ip_address` (inet, nullable), `user_agent` (text, nullable)
- `status` (enum: `eingegangen` | `in_bearbeitung` | `abgeschlossen`, default `eingegangen`)
- Standardfelder: `id`, `created_at`, `updated_at`

RLS:
- Nur `admin`/`board` dürfen SELECT/UPDATE (über `is_staff`)
- INSERT erfolgt ausschließlich über Server-Function mit `supabaseAdmin` (kein anon-/authenticated-INSERT-Policy)
- GRANTs entsprechend (authenticated SELECT/UPDATE, service_role ALL)

Audit-Log-Integration: Statusänderungen werden in `audit_logs` protokolliert.

## 2. Server-Funktionen

`src/lib/cancellation.functions.ts`:
- `submitCancellation` (public, ohne Auth) — Zod-Validierung, Honeypot-Spamcheck, Rate-Limit pro IP (max 3/h via DB-Check letzte Einträge), Referenznummer-Generierung, Insert via `supabaseAdmin`, beide E-Mails enqueuen, gibt Referenznummer zurück
- `listCancellations` (admin/board) — Liste mit Filter (status, suche, datum)
- `setCancellationStatus` (admin/board) — Statusänderung + audit log
- `exportCancellationsCsv` (admin/board) — CSV-Export

## 3. E-Mail-Templates

Zwei neue Templates in `src/lib/email-templates/`:
- `cancellation-internal.tsx` — interne Benachrichtigung an `widerruf@sicher-schwimmen.com` (alle Formulardaten + Eingangsdatum/IP/Referenz)
- `cancellation-confirmation.tsx` — Eingangsbestätigung an Eltern mit Referenznummer

Registrierung in `registry.ts`. Versand über bestehende Queue `/lovable/email/transactional/send` mit `idempotencyKey = reference_number + template`.

## 4. Frontend-Seite `/widerruf`

`src/routes/widerruf.tsx`:
- PublicLayout, SEO-Metadaten
- **Widerrufsbelehrung**-Sektion (deutsches Verbraucherrecht §355 BGB): Widerrufsfrist, Folgen, Kontaktmöglichkeiten, Hinweis Online-Übermittlung
- **Muster-Widerrufsformular** mit react-hook-form + Zod:
  - Pflichtfelder: Vorname, Nachname, E-Mail, Telefon, Name des Kindes, Kursname, Buchungsdatum
  - Optional: Bemerkungen
  - Vorbefüllter Widerrufstext (editierbar)
  - Pflicht-Checkbox „Ich erkläre hiermit den Widerruf …"
  - Honeypot-Feld (versteckt) gegen Bots
  - Inline-Fehlermeldungen
- **Datenschutzhinweis** unter Formular + Link zu `/datenschutz`, Hinweis Aufbewahrungsdauer (3 Jahre, gesetzliche Frist)
- **Erfolgsmeldung** mit Referenznummer ersetzt Formular nach Submit

## 5. Wiederverwendbare Widerruf-Button-Komponente

`src/components/CancellationButton.tsx` — Link-Button „Vertrag widerrufen" zu `/widerruf`, variant=outline, barrierefrei (aria-label).

Eingebunden in:
- `SiteFooter.tsx` (Rechtliches-Sektion)
- `routes/kurse.tsx` (am Ende)
- `routes/kurs-anfragen.tsx` (am Ende)
- `email-templates/course-assignment.tsx` (Link zur Widerrufsseite in der Zuteilungs-E-Mail)
- Header-Dropdown „Rechtliches" in `SiteHeader.tsx`

## 6. Admin-Bereich `/admin/widerrufe`

`src/routes/_authenticated/admin/widerrufe.tsx`:
- Auth-Guard via `assertHasAnyRole(['admin','board'])` in `beforeLoad`
- Tabelle: Referenz, Datum, Eltern, Kind, Kurs, Status
- Filter: Status-Dropdown, Suche (Name/Email/Referenz), Zeitraum
- Status-Dropdown pro Zeile (mit `setCancellationStatus`)
- CSV-Export-Button
- Detail-Dialog mit allen Feldern inkl. Widerrufstext, IP, Bemerkungen
- Sidebar-Eintrag in `admin/route.tsx` (nur admin/board sichtbar)

## 7. Sicherheit & DSGVO

- Server-Validierung mit Zod (Längenlimits, E-Mail-Format)
- IP nur bei explizitem Hinweis im Datenschutztext gespeichert
- Honeypot + einfaches Rate-Limit (DB-basiert, kein externer Dienst)
- Fehler in `console.error` (Worker-Logs)
- HTTPS via Hosting bereits gegeben

## Technische Details

```text
Dateien (neu):
  src/routes/widerruf.tsx
  src/routes/_authenticated/admin/widerrufe.tsx
  src/components/CancellationButton.tsx
  src/lib/cancellation.functions.ts
  src/lib/email-templates/cancellation-internal.tsx
  src/lib/email-templates/cancellation-confirmation.tsx
  supabase/migrations/<ts>_cancellation_requests.sql

Dateien (geändert):
  src/components/SiteFooter.tsx        (+ Widerruf-Link)
  src/components/SiteHeader.tsx        (+ Widerruf in Rechtliches)
  src/routes/kurse.tsx                 (+ CancellationButton)
  src/routes/kurs-anfragen.tsx         (+ CancellationButton)
  src/lib/email-templates/registry.ts  (+ 2 Templates)
  src/lib/email-templates/course-assignment.tsx (+ Widerruf-Hinweis)
  src/routes/_authenticated/admin/route.tsx  (+ Sidebar-Eintrag)
```

Referenznummer: `SW-WID-${YYYYMMDD}-${5-stellig zufällig}`, Eindeutigkeit per DB-Constraint + Retry.

## Offene Punkte
1. Existiert die Adresse `widerruf@sicher-schwimmen.com` als Mailbox? Falls nein, soll ich stattdessen `info@sicher-schwimmen.com` verwenden?
2. Aufbewahrungsdauer der Widerrufsdaten — 3 Jahre (Standard nach §195 BGB) ok?
