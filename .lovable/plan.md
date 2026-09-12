# Mitgliedschaft im Schwimmverband NRW sichtbar machen

Der Hinweis erscheint an zwei Stellen – dezent, aber auf jeder Seite erreichbar.

## Wo der Hinweis erscheint

1. **Fußzeile (jede Seite)** – in der Spalte „Verein“ eine kurze Zeile: „Mitglied im Schwimmverband NRW“, verlinkt auf www.schwimmverband.nrw, öffnet in neuem Tab.
2. **Seite „Über uns“** – im Abschnitt zum Verein ein kurzer Satz mit Link: „Sicher Schwimmen e.V. ist Mitglied im Schwimmverband NRW.“ Direkt bei der Angabe zum Vereinsregister, damit die offiziellen Angaben beisammenstehen.

Nur Text und Link – kein fremdes Logo, da für Verbandslogos meist eine ausdrückliche Nutzungserlaubnis nötig ist. Wenn Sie das Logo verwenden dürfen und es mir schicken, ergänze ich es gerne.

## Technische Details

- Neuer Eintrag in `src/lib/billing-config.ts` (Name, URL `https://www.schwimmverband.nrw`) als zentrale Quelle.
- `src/components/SiteFooter.tsx`: Zeile in der Spalte „Verein“ mit `target="_blank" rel="noopener noreferrer"`.
- `src/routes/ueber-uns.tsx`: Satz mit Link neben dem Registerhinweis.
- Keine weiteren Inhalte, Texte oder Designs werden geändert.
