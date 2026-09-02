# Baderegeln-Poster auf der Kursseite

Das hochgeladene Poster „Baderegeln für dein Seepferdchen" wird auf der Kursseite eingebunden – zum Anschauen (Vollbild) und als Download.

## Was Eltern sehen

Auf `/kurse` erscheint unterhalb der Kurskacheln ein neuer Abschnitt „Baderegeln für dein Seepferdchen":

- Vorschaubild des Posters (klickbar, öffnet eine große Ansicht im Overlay/Dialog)
- Kurzer Einleitungstext: 10 Baderegeln plus Rettungskette, entwickelt für Kinder auf dem Weg zum Seepferdchen
- Button „Poster herunterladen" (lädt die Bilddatei direkt herunter)
- Hinweis auf die Quellen (DLRG e.V., Deutscher Schwimm-Verband e.V.), wie im Poster-Fuß angegeben

Auf den Kursdetailseiten (`/kurse/<slug>`) wird derselbe Abschnitt kompakter (Vorschau + Download-Button) ergänzt, damit Eltern ihn direkt beim gebuchten Kurs finden.

## Technisches Vorgehen

- Poster über die Lovable-Asset-CDN einbinden (`src/assets/baderegeln-seepferdchen.png.asset.json`), damit die große Bilddatei nicht im Repository liegt.
- Neue Komponente `src/components/BaderegelnCard.tsx`:
  - `variant="full"` (Kursübersicht) und `variant="compact"` (Detailseite)
  - Vorschau via `Dialog` aus shadcn für die Großansicht
  - Download über `<a href={url} download="Baderegeln-Sicher-Schwimmen.png">`
  - Alt-Text für Barrierefreiheit und SEO
- Einbindung in `src/routes/kurse.tsx` und `src/routes/kurse_.$slug.tsx`.
- Keine Änderungen an Datenbank, Buchungslogik oder E-Mails.

## Offene Punkte

Falls zusätzlich eine PDF-Version zum Ausdrucken gewünscht ist, kann diese aus dem Bild erzeugt und als zweiter Download-Button angeboten werden.
