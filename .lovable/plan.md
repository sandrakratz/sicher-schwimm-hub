# REWE „Scheine für Vereine“ auf der Website

Empfehlung: an drei Stellen sichtbar, alle aus einer einzigen Stelle gesteuert und automatisch nach dem 15.10.2026 verschwindend.

## Wo der Hinweis erscheint

1. **Startseite** – ein dezenter Aktions-Streifen direkt unter dem großen Kopfbereich: kurzer Satz („Unterstützen Sie uns mit Ihren REWE-Scheinen“) plus das offizielle REWE-Banner als Link.
2. **Fußzeile (jede Seite)** – das REWE-Banner klein in der Spalte „Verein“, damit der Hinweis überall erreichbar ist, ohne aufdringlich zu sein.
3. **News-Seite** – ein Aktionshinweis oben auf der Seite mit zwei bis drei Sätzen Erklärung und demselben Banner.

Alle Links öffnen in einem neuen Tab und führen auf das Vereinsprofil bei REWE.

## Automatisches Ausblenden

Ein festes Enddatum: **15.10.2026, 23:59 Uhr (Berliner Zeit)**. Ab dem 16.10.2026 wird der Hinweis an allen drei Stellen automatisch nicht mehr angezeigt – kein manuelles Eingreifen nötig. Vorher lässt sich der Hinweis bei Bedarf auch sofort abschalten.

## Technische Details

- Neue Datei `src/lib/rewe-aktion.ts`: Link-URL, Bildpfad, Titel/Alt-Texte, `REWE_CAMPAIGN_END` (2026-10-15T23:59:59+02:00) und `isReweCampaignActive()` (Vergleich in Berliner Zeit über die bestehenden Zeitzonen-Helfer).
- Neue Komponente `src/components/ReweSfvBanner.tsx` mit den Varianten `inline` (Startseite/News) und `compact` (Fußzeile); rendert nichts, wenn die Aktion beendet ist. Bild 240x45, `loading="lazy"`, `target="_blank"`, `rel="noopener noreferrer"`, Alt-Text „REWE Scheine für Vereine – Sicher Schwimmen e.V.“
- Einbindung in `src/routes/index.tsx` (unter dem Hero), `src/components/SiteFooter.tsx` (Spalte „Verein“) und `src/routes/news.tsx` (oberhalb der Beiträge).
- Das Banner-Bild wird direkt von REWE geladen (wie im vorgegebenen Code); es werden keine Inhalte, Texte oder Designs außerhalb dieser Stellen geändert.
- Damit nach Aktionsende kein veralteter Stand ausgeliefert wird, prüft die Anzeige das Datum beim Rendern im Browser (kein fest gebackenes Ergebnis aus dem Build).
