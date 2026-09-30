# Neue Einrichtung (Cloudflare + Supabase + Resend)

Diese Datei beschreibt, was nach dem Umzug von Lovable Cloud eingerichtet sein muss. Sie ist die Arbeitsgrundlage
für die Schritte in der Reihenfolge unten. Keine geheimen Werte in diese Datei schreiben.

## 1. Umgebungsvariablen (Cloudflare → Worker → Settings → Variables and Secrets)

| Name | Art | Woher |
|---|---|---|
| SUPABASE_URL | Variable | Supabase → Project Settings → API |
| SUPABASE_PUBLISHABLE_KEY | Variable | dito („anon“/„publishable“ Key) |
| SUPABASE_SERVICE_ROLE_KEY | **Secret** | dito („service_role“ Key, niemals öffentlich) |
| VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID | Build-Variable | gleiche Werte; werden beim Bauen in die Seite eingebaut |
| RESEND_API_KEY | **Secret** | Resend → API Keys (Berechtigung „Sending access“) |
| RESEND_WEBHOOK_SECRET | **Secret** | Resend → Webhooks → Signing secret |
| SEND_EMAIL_HOOK_SECRET | **Secret** | Supabase → Authentication → Hooks → Send Email (beim Anlegen erzeugt, beginnt mit `v1,whsec_`) |
| VAPID_SEED | **Secret** | beliebiger langer Zufallstext. Der alte Wert lässt sich in Lovable nicht auslesen; Handy-Mitteilungen müssen deshalb einmal neu erlaubt werden |

Nicht mehr nötig: LOVABLE_API_KEY, LOVABLE_SEND_URL, GOOGLE_SEARCH_CONSOLE_API_KEY, STRIPE_SECRET_KEY, DATABASE_URL.

## 2. Supabase

1. Projekt in Region **Frankfurt (EU)** anlegen.
2. Vor dem Einspielen der Daten unter Database → Extensions **pg_cron** und **pg_net** einschalten (die Migrationen und Zeitpläne setzen sie voraus).
3. Struktur und Daten einspielen (Lovable-Export bzw. die Dateien unter `supabase/migrations/`).
4. Speicherbereiche `documents` und `media` (beide privat) – werden von der Migration `20260930120000_create_storage_buckets.sql` angelegt. Die 9 Dateien
   (Liste in `storage.md`) mit **exakt gleichem Dateinamen** hochladen, weil die Datenbank die Namen speichert
   (`documents/…`, `media/events/…`, `media/news/…`).
5. Authentication:
   - Sign-in: nur E-Mail + Passwort. „Confirm email“ **an**, Registrierung offen lassen wie bisher.
   - URL Configuration: Site URL `https://sicher-schwimmen.com`; Redirect URLs `https://sicher-schwimmen.com/**`, `https://www.sicher-schwimmen.com/**`.
   - Hooks → **Send Email** → HTTPS → `https://sicher-schwimmen.com/email/auth-hook`. Erzeugtes Secret siehe Tabelle oben.
6. Admin-Schlüssel (service_role) neu kopieren – der alte war in Lovable nicht einsehbar.

## 3. Resend

1. Domain `notify.sicher-schwimmen.com` hinzufügen (Region EU wählen) und die angezeigten DNS-Einträge setzen. Die Hauptdomain und die Postfächer bei One.com bleiben unberührt.
2. Webhook anlegen: `https://sicher-schwimmen.com/email/events`, Ereignisse `email.bounced` und `email.complained`.
3. Der kostenlose Tarif erlaubt 100 Mails/Tag. Ab 80 Mails in 24 Stunden geht automatisch eine Warnung an info@sicher-schwimmen.com.

## 4. Tägliche Aufgaben neu anlegen

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

## 5. Cloudflare

Noch offen, siehe Pull-Request-Beschreibung: Die Sperre der Paketquelle (bun.lock) muss zuerst geklärt werden.
