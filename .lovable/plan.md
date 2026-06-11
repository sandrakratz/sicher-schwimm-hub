## SEO-Status

Was bereits gut ist:
- Jede Seite hat einen eigenen `<title>` und `<meta name="description">`
- Open-Graph- und Twitter-Card-Tags sind gesetzt
- Semantische Struktur (H1, H2) auf allen Seiten

Was fehlt für gute Auffindbarkeit:

1. **Keine `sitemap.xml`** — Google findet so neue Seiten langsamer
2. **Keine `robots.txt`** — keine Crawler-Steuerung, kein Sitemap-Hinweis
3. **Keine `<link rel="canonical">`** — Risiko von Duplicate Content (z. B. sicher-schwimmen.com vs. www. vs. lovable.app)
4. **Kein strukturiertes Datenmodell (JSON-LD)** — Google zeigt damit Adresse, Öffnungszeiten, FAQ direkt im Suchergebnis
5. **`<html lang="en">`** statt `"de"` — falsches Sprach-Signal an Google
6. **Lokale Keywords fehlen** in vielen Descriptions (Hennef, Rhein-Sieg-Kreis, Sankt Augustin, Siegburg, Bonn-Umland, „Schwimmen lernen", „Seepferdchen Kurs")
7. **`og:image` im Root** überschreibt alle Kinderseiten (sollte nur auf Leaf-Routes liegen)

## Plan

### 1. Sitemap & Crawler
- `src/routes/sitemap[.]xml.ts` als Server-Route mit allen öffentlichen Routen (/, /kurse, /mitgliedschaft, /ueber-uns, /sicherheit, /kontakt, /faq, /news, /kurs-anfragen, /kursbedingungen, /satzung, /mitgliedsordnung, /datenschutz, /impressum)
- `public/robots.txt` mit `Allow: /`, `Disallow: /portal/`, `/admin/`, `/auth`, `/reset-password`, `/lovable/`, `/api/` und `Sitemap: https://sicher-schwimmen.com/sitemap.xml`

### 2. Canonical URLs
- Pro öffentlicher Leaf-Route ein `<link rel="canonical" href="https://sicher-schwimmen.com/...">` über `head().links`
- Zusätzlich `og:url` pro Seite

### 3. Strukturierte Daten (JSON-LD)
- **Root**: `SportsClub` / `Organization` (Name, URL, Logo, Adresse Hennef, Kontakt-E-Mail, Vorstandsmitglieder)
- **Kontakt**: `LocalBusiness` mit Adresse, Telefon, E-Mail, Servicegebiet (Hennef + Rhein-Sieg-Kreis)
- **FAQ**: `FAQPage` aus den bestehenden Fragen — kann direkt in den Google-Ergebnissen angezeigt werden
- **Kurse**: `Course`-Einträge pro angebotenem Kurs

### 4. Lokale Keywords stärken
Descriptions und H1/H2 dezent erweitern um lokale Begriffe — ohne Keyword-Stuffing:
- Hennef, Rhein-Sieg-Kreis, Sankt Augustin, Siegburg, Bonn
- „Schwimmkurs für Kinder", „Seepferdchen-Kurs", „Wassergewöhnung", „Schwimmen lernen"
- Betroffene Seiten: Index, Kurse, Kontakt, Über uns, Sicherheit

### 5. Technische Korrekturen
- `<html lang="en">` → `<html lang="de">` in `__root.tsx`
- `og:image` aus `__root.tsx` entfernen und stattdessen auf Leaf-Routes setzen (Home: Pool-Bild; Über uns: Vorstandsbild; etc.) — sonst hat jede Seite das gleiche Vorschaubild
- `theme-color` Meta-Tag (Vereinsfarbe) für mobile Browser

### 6. Optional (nach Bestätigung)
- **Semrush-Check** für Keyword-Volumen rund um "Schwimmkurs Hennef", "Seepferdchen Rhein-Sieg" — damit wir Descriptions auf tatsächlich gesuchte Begriffe ausrichten
- Google Search Console Verifikation (Meta-Tag) — gibst du mir den Code, baue ich ihn ein

## Technische Details

- Sitemap ist eine TanStack-Server-Route, nicht eine statische Datei — bleibt mit den Routen synchron
- JSON-LD wird über `head().scripts` als `application/ld+json` ausgeliefert (SSR, also crawler-sichtbar)
- Canonicals werden NUR auf Leaf-Routes gesetzt (TanStack Router #6719 — Root + Leaf würde Duplikate emittieren)
- Keine Backend-/Logik-Änderungen, reine SEO/Frontend-Arbeit

Soll ich so umsetzen, oder etwas weglassen/erweitern (z. B. Semrush-Recherche vorab)?
