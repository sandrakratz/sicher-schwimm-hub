# Neue Einrichtung (Cloudflare + Supabase + Resend)

Diese Datei beschreibt, was nach dem Umzug von Lovable Cloud eingerichtet sein muss. Sie ist die Arbeitsgrundlage
für die Schritte in der Reihenfolge unten. Keine geheimen Werte in diese Datei schreiben.

## 1. Umgebungsvariablen (Cloudflare → Worker → Settings → Variables and Secrets)

| Name | Art | Woher |
|---|---|---|
| SUPABASE_URL | Variable, **steht in `wrangler.jsonc`** | Supabase → Project Settings → API. Nicht im Dashboard pflegen: `wrangler deploy` entfernt dort angelegte Text-Variablen, die nicht in der Konfiguration stehen |
| SUPABASE_PUBLISHABLE_KEY | Variable, **steht in `wrangler.jsonc`** | dito („anon“/„publishable“ Key), öffentlich |
| SUPABASE_SERVICE_ROLE_KEY | **Secret** | dito („service_role“ Key, niemals öffentlich) |
| VITE_SUPABASE_URL, VITE_SUPABASE_PROJECT_ID, VITE_SUPABASE_PUBLISHABLE_KEY | schon in `.env` im Repository | öffentliche Werte des neuen Projekts (`kqaajxvwdwpgrxwgqcvi`); werden beim Bauen in die Seite eingebaut, bei Cloudflare nichts nötig |
| RESEND_API_KEY | **Secret** | Resend → API Keys (Berechtigung „Sending access“) |
| RESEND_WEBHOOK_SECRET | **Secret** | Resend → Webhooks → Signing secret |
| SEND_EMAIL_HOOK_SECRET | **Secret** | Supabase → Authentication → Hooks → Send Email (beim Anlegen erzeugt, beginnt mit `v1,whsec_`) |
| VAPID_SEED | **Secret** | beliebiger langer Zufallstext. Der alte Wert lässt sich in Lovable nicht auslesen; Handy-Mitteilungen müssen deshalb einmal neu erlaubt werden |

**Wichtig:** Alle Geheimnisse in Cloudflare als Typ **Secret** anlegen, nicht als „Text“. Secrets bleiben bei jedem Deploy erhalten, Text-Variablen
werden vom Deploy gelöscht. Die zwei öffentlichen Werte stehen deshalb in `wrangler.jsonc` im Projekt (Nitro mischt die Datei beim Bau in die erzeugte
`.output/server/wrangler.json`). Beim Wechsel auf ein anderes Supabase-Projekt die Werte in `wrangler.jsonc` **und** in `.env` ändern.

Nicht mehr nötig: LOVABLE_API_KEY, LOVABLE_SEND_URL, GOOGLE_SEARCH_CONSOLE_API_KEY, STRIPE_SECRET_KEY, DATABASE_URL.

**Lokal entwickeln:** Geheime Werte (z. B. `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `VAPID_SEED`, Datenbank-Passwort) gehören in die Datei
**`.env.local`** im Projektordner, nicht in `.env`. `.env.local` wird beim lokalen Start gelesen und ist über `*.local` in `.gitignore` ausgeschlossen.
Die `.env` ist im öffentlichen Repository versioniert und darf **nur öffentliche Werte** enthalten (URL, Projekt-ID, Publishable Key).

## 2. Supabase

1. Projekt in Region **Frankfurt (EU)** anlegen.
2. Vor dem Einspielen der Daten unter Database → Extensions **pg_cron** und **pg_net** einschalten (die Migrationen und Zeitpläne setzen sie voraus).
3. Struktur und Daten einspielen (Lovable-Export bzw. die Dateien unter `supabase/migrations/`).
4. Speicherbereiche `documents` und `media` (beide privat) – werden von der Migration `20260930120000_create_storage_buckets.sql` angelegt. Die 9 Dateien
   (Liste in `storage.md`) mit **exakt gleichem Dateinamen** hochladen, weil die Datenbank die Namen speichert
   (`documents/…`, `media/events/…`, `media/news/…`).
   Zusätzlich der private Bereich `branding` (Migration `20261001130000_branding_bucket.sql`) mit den zwei Dateien **`signature.png`** (Unterschrift) und
   **`stamp.png`** (Vereinsstempel), exakt so benannt. Sie stehen **nicht** im Code (öffentliches Repository) und werden nur beim Erstellen der
   Teilleistungsnachweise vom Server geladen. Fehlt eine Datei, wird kein Nachweis erstellt (Fehlermeldung im Verwaltungsbereich bzw. im Protokoll).
5. Authentication:
   - Sign-in: nur E-Mail + Passwort. „Confirm email“ **an**, Registrierung offen lassen wie bisher.
   - URL Configuration: Site URL `https://sicher-schwimmen.com`; Redirect URLs `https://sicher-schwimmen.com/**`, `https://www.sicher-schwimmen.com/**`.
   - Hooks → **Send Email** → HTTPS → `https://sicher-schwimm-hub.tiny-lab-6d41.workers.dev/email/auth-hook` (Adresse des Workers, unabhängig vom DNS;
     die Adresse der Domain geht erst nach dem Umschalten). Erzeugtes Secret **zuerst** bei Cloudflare als `SEND_EMAIL_HOOK_SECRET` eintragen, **dann** den Hook bei Supabase speichern.
   - Zusätzlich in URL Configuration die Redirect-URL `https://sicher-schwimm-hub.tiny-lab-6d41.workers.dev/**` eintragen, wenn auf der Worker-Adresse getestet werden soll.
   - „Allow new users to sign up“ **an** lassen: Konten entstehen am Ende des Mitgliedsantrags. Die Freischaltung durch den Vorstand läuft in der App (Profilstatus `pending`), nicht über diesen Schalter.
6. Admin-Schlüssel (service_role) neu kopieren – der alte war in Lovable nicht einsehbar.

## 3. Resend

1. Domain `versand.sicher-schwimmen.com` hinzufügen (Region EU, „Enable Receiving“ aus) und die angezeigten DNS-Einträge bei One.com setzen
   (aktuell ein TXT für DKIM und zwei CNAME, Namen enden auf `.versand`). **Nicht** `notify…` verwenden: Diese Unteradresse ist per NS-Eintrag
   (`ns3/ns4.lovable.cloud`) an Lovable delegiert; Einträge darunter würden von Lovable beantwortet, nicht von One.com. Den NS-Eintrag erst nach
   dem Umschalttag entfernen. Die Hauptdomain und die Postfächer bei One.com bleiben unberührt.
2. Webhook anlegen: `https://…/email/events` (aktuell auf der Worker-Adresse eingetragen, bleibt auch nach dem Umschalten gültig), Ereignisse `email.bounced` und `email.complained`.
3. Der kostenlose Tarif erlaubt 100 Mails/Tag. Ab 80 Mails in 24 Stunden geht automatisch eine Warnung an info@sicher-schwimmen.com.

## 4. Tägliche Aufgaben neu anlegen

**Reihenfolge:** Erst die alten Aufgaben im alten Projekt (Lovable Cloud) pausieren, dann die neuen anlegen – sonst gehen Erinnerungen doppelt raus.
Voraussetzung: Erweiterungen `pg_cron` und `pg_net` sind eingeschaltet. Am 01.10.2026 so eingerichtet; Kontrolle:
`select jobname, schedule, active from cron.job order by jobname;` (5 Zeilen, alle `true`) und
`select id, status_code, created from net._http_response order by created desc limit 10;` (nach dem ersten Lauf `200`; `401` = falscher Schlüssel in der Aufgabe).

Im Supabase SQL-Editor ausführen. `<PUBLISHABLE_KEY>` durch den öffentlichen Schlüssel des **neuen** Projekts ersetzen.
Falls die Zeitpläne aus dem Lovable-Export mit der alten Adresse mitkamen, werden sie dabei ersetzt.

```sql
do $$
declare j record;
begin
  for j in select * from (values
    ('course-start-reminder-daily', '0 6 * * *',  'course-start-reminder'),
    ('majority-notice-daily',       '0 6 * * *',  'majority-notice'),
    ('partial-certificate-daily',   '30 14 * * *', 'partial-certificate'),
    ('payment-check-reminder-daily','0 6 * * *',  'payment-check-reminder'),
    ('waitlist-sweep-hourly',       '0 * * * *',  'waitlist-sweep')
  ) as t(name, schedule, hook)
  loop
    perform cron.unschedule(j.name) where exists (select 1 from cron.job where jobname = j.name);
    perform cron.schedule(
      j.name, j.schedule,
      format($cmd$select net.http_post(
        url:='https://sicher-schwimmen.com/api/public/hooks/%s',
        headers:='{"Content-Type": "application/json", "apikey": "<PUBLISHABLE_KEY>"}'::jsonb,
        body:='{}'::jsonb, timeout_milliseconds:=30000) as request_id;$cmd$, j.hook)
    );
  end loop;
end $$;
```

Hinweis zum Pausieren (kostenloser Supabase-Tarif): Die stündliche Wartelisten-Aufgabe ruft die App auf, die dabei die Datenbank abfragt.
Das hält das Projekt voraussichtlich wach, ist von Supabase aber nicht zugesichert. Eine eigene Sicherung ist zusätzlich nötig (offen).

## 5. Cloudflare (Worker mit Git-Anbindung)

Der Bau (`bun run build`) erzeugt fertig eine Cloudflare-Konfiguration (`.output/server/wrangler.json`, Name
`sicher-schwimm-hub` aus `wrangler.jsonc`, Node-Kompatibilität an). Stand 01.10.2026: Der Worker läuft produktiv unter
`sicher-schwimmen.com` und `www.sicher-schwimmen.com` (Ablauf siehe Abschnitt 6).

1. Cloudflare → Workers & Pages → Create → Import a repository → dieses GitHub-Repository, Branch `main`.
2. Build command: `bun run build` · Deploy command: `bunx wrangler deploy` (folgt der beim Bau erzeugten Konfiguration).
3. Variablen aus Abschnitt 1 eintragen (Laufzeit-Variablen unter Settings → Variables and Secrets). Die `VITE_…`-Werte stehen schon in `.env` und werden beim Bauen eingebaut.
   Den Worker-Namen in Cloudflare exakt `sicher-schwimm-hub` nennen (so steht er in `wrangler.jsonc`).
4. Zuerst mit der vorläufigen `*.workers.dev`-Adresse testen (Anmeldung, Mail, Datei, Zeitplan von Hand auslösen).
5. Erst danach die Domain umstellen (Ablauf mit allen Stolpersteinen in Abschnitt 6).
6. Hinweis zur Rechenzeit: Der kostenlose Cloudflare-Tarif begrenzt die Rechenzeit pro Anfrage (10 ms). Falls PDF- oder Excel-Erzeugung
   mit „Worker exceeded CPU time limit“ scheitert, hilft der Tarif „Workers Paid“ (ca. 5 $/Monat).

Die Bilder (Logo, Baderegeln-Poster, Vorstandsfotos) liegen jetzt als normale Dateien in `src/assets/` und werden mit der Seite ausgeliefert.

## 6. Umschalttag (01.10.2026): Ablauf und Stolpersteine

### Ablauf, der funktioniert hat
1. **DNS vorbereiten:** In Cloudflare → Domains → Add a domain `sicher-schwimmen.com` (Tarif Free, Einträge automatisch einlesen lassen). Der Scan findet MX, SPF, DMARC und die Google-Bestätigung,
   **nicht** die Einträge der Unteradressen. Von Hand nachtragen (jeweils **DNS only**, kein Proxy): die beiden CNAME `rsend.versand` und `send.versand` sowie den TXT `resend._domainkey.versand`
   (Werte 1:1 aus One.com bzw. Resend kopieren). Die A-Einträge der alten Seite (Lovable-Adresse), `_lovable…` und `notify`-NS **nicht** übernehmen bzw. löschen.
2. **DNSSEC bei One.com deaktivieren** (DNS → Nameserver → DNSSEC), bevor die Nameserver gewechselt werden. Sonst können Besucher die Domain zeitweise nicht auflösen.
3. **Nameserver bei One.com** auf die beiden von Cloudflare genannten ändern, danach in Cloudflare „I updated my nameservers“. Die Domain war nach wenigen Minuten aktiv.
4. **Domains mit dem Worker verbinden:** Worker → Settings → Domains & Routes → Add Domain → Custom domain. Das geht erst, wenn die Domain bei Cloudflare **aktiv** ist. Die Domain wird dabei
   **getrennt** eingegeben: Feld „Subdomain“ leer lassen für `sicher-schwimmen.com`, `www` für `www.sicher-schwimmen.com`. Eingabe des vollen Namens in einem Feld führt zu „No zones match“.
   **Nicht** „Find similar“ oder „Onboard domain“ wählen (das ist der Weg zum Domain-Kauf).
5. **Danach:** Aufgaben anlegen (Abschnitt 4), Test-Mail an und von einem Postfach bei One.com. Lokale DNS-Zwischenspeicher (PC, Router, Anbieter) brauchen teils Stunden; zum Prüfen das Handy im Mobilfunknetz
   oder `dnschecker.org` nutzen.

### Stolperstein: Lovable schreibt in das Repository
Lovable war mit dem GitHub-Repository verbunden. Beim Pausieren der Aufgaben hat es am 01.10.2026 vier Änderungen in `main` geschrieben und dabei `.env` auf das **alte** Projekt zurückgestellt
sowie `bun.lock`/`package.json` verändert (Verweise auf Lovables privates Paketlager). Cloudflare hat daraus sofort gebaut und live geschaltet: Browser sprach mit der alten, der Server mit der neuen Datenbank,
Buchungen funktionierten nicht mehr. Behoben durch Rollback bei Cloudflare (Worker → Deployments → Version History → Rollback auf den letzten guten Stand) und anschließend Zurücksetzen der drei Dateien per Pull Request.
- **Verbindung zwischen Lovable und GitHub getrennt** (in den GitHub-Einstellungen des Lovable-Projekts). Nicht wieder verbinden.
- Vor jedem Übernehmen eines Pull Requests prüfen, dass `.env` weiter auf das neue Projekt (`kqaajxvwdwpgrxwgqcvi`) zeigt.
- Jede Änderung in `main` löst bei Cloudflare einen Bau und eine Live-Schaltung aus. Rollback ist jederzeit möglich.

### Stolperstein: Vorschau-Adressen
Die `*-sicher-schwimm-hub.tiny-lab-6d41.workers.dev`-Vorschauen einzelner Zweige haben nicht die Einstellungen der Hauptadresse und zeigen deshalb die Fehlerseite. Zum Testen die Hauptadresse
`sicher-schwimm-hub.tiny-lab-6d41.workers.dev` verwenden.

## 7. Nach dem Umzug (Stand 01.10.2026)

- Das Lovable-Projekt ist stillgelegt (alle fünf Aufgaben pausiert, Seite nicht mehr veröffentlicht), aber **nicht gelöscht**. Die alte Datenbank bleibt vier bis sechs Wochen als Sicherung; vor dem Löschen ein letzter Export.
- Daten, die zwischen dem Export vom 30.09. und dem Umschalten in der alten Datenbank angekommen sind, prüfen und bei Bedarf in der neuen nachtragen.
- Der NS-Eintrag `notify` (→ `ns3/ns4.lovable.cloud`) liegt nicht mehr in der DNS-Zone und braucht keine Aktion; Lovable-Postfach-Verifizierungen (`_lovable…`) sind entfallen.
- Resend (kostenloser Tarif): 100 Mails/Tag, Warnung ab 80 Mails in 24 Stunden an `info@sicher-schwimmen.com`.
- Kontrolle am Folgetag: erster Lauf der täglichen Aufgaben (Zeitpläne in UTC: 06:00 UTC = 08:00 Uhr Sommerzeit, ab Ende Oktober 07:00 Uhr Winterzeit) mit der Abfrage aus Abschnitt 4 prüfen.
