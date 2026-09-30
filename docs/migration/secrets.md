# Geheimnisse und Umgebungsvariablen (nur Namen, keine Werte)

Stand: 30.09.2026.

## Hinterlegte Geheimnisse (Secrets)
| Name | Verwendung |
|---|---|
| VAPID_SEED | Grundlage für die VAPID-Schlüssel der Web-Push-Mitteilungen (`src/lib/push.server.ts`). Beim Umzug unbedingt übernehmen, sonst werden alle bestehenden Handy-Abos ungültig. |
| LOVABLE_API_KEY | Von Lovable verwaltet. Authentifiziert den E-Mail-Versand über die Lovable-E-Mail-Schnittstelle und ggf. KI-Aufrufe. Auf eigener Infrastruktur nicht übertragbar – muss durch einen eigenen E-Mail-Anbieter ersetzt werden. |
| GOOGLE_SEARCH_CONSOLE_API_KEY | Von einem Connector verwaltet (Google Search Console). Wird vom App-Code nicht verwendet. |

## Automatisch bereitgestellte Variablen (Lovable Cloud / Server)
| Name | Verwendung |
|---|---|
| SUPABASE_URL | Adresse des Backends (serverseitig) |
| SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY | Öffentlicher Schlüssel (serverseitig) |
| SUPABASE_SERVICE_ROLE_KEY | Admin-Zugriff für serverseitige Funktionen (`client.server.ts`). Auf Lovable Cloud nicht einsehbar – in der neuen Infrastruktur neu erzeugen. |
| DATABASE_URL | im Code referenziert (Datenbankverbindung) |
| LOVABLE_SEND_URL | optionale Adresse der Lovable-E-Mail-Schnittstelle |
| STRIPE_SECRET_KEY | im Code referenziert, aber nicht als Secret hinterlegt (keine aktive Nutzung) |
| NODE_ENV | Laufzeitmodus |

## Variablen in `.env` (Client, öffentlich)
SUPABASE_PROJECT_ID, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, VITE_SUPABASE_PROJECT_ID, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_URL
