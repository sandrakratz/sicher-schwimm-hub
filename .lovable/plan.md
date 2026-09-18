# Bilder für News und Termine

Künftig kann ein Beitrag oder Termin auch nur aus einem Bild bestehen. Text bleibt möglich, ist aber nicht mehr Pflicht.

## Was sich ändert

**Beim Anlegen (Verwaltung News / Termine)**
- Neues Feld „Bild oder PDF" mit Datei-Auswahl (JPG, PNG, PDF, max. 10 MB).
- Nach dem Hochladen erscheint eine kleine Vorschau; die Datei kann wieder entfernt oder ersetzt werden.
- Pflichtangabe ist nur noch der Titel. Ein Beitrag ohne Text, aber mit Bild lässt sich speichern. Ein Beitrag ganz ohne Text und ohne Bild nicht.
- Optionaler Bildtext (Alternativtext) für Barrierefreiheit; bleibt er leer, wird der Titel verwendet.

**Für Besucher und Mitglieder**
- Auf der News-Seite und in der Mitglieder-/Terminübersicht wird das Bild groß im Beitrag angezeigt, oberhalb des Textes (falls Text vorhanden).
- Ein PDF wird als anklickbare Kachel mit Dateiname angezeigt und öffnet sich in einem neuen Tab (PDFs lassen sich nicht als Bild darstellen).
- Bilder werden per Klick in voller Größe geöffnet.

## Technische Umsetzung

1. **Speicher**: neuer öffentlicher Bucket `media` (Dateigrößenlimit 10 MB) mit Ablage unter `news/...` und `events/...`. Leseregel öffentlich, Schreib-/Löschregeln nur für Rollen `admin`/`board` über `storage.objects`-Policies.
2. **Migration**: Spalten `image_url text`, `image_alt text`, `image_mime text` auf `public.news` und `public.events`. `news.content` verliert `NOT NULL` (Default `''` bleibt bestehen), damit reine Bild-Beiträge möglich sind.
3. **Verwaltung**: Upload-Block (analog `src/routes/_authenticated/admin/dokumente.tsx`) in `src/routes/_authenticated/admin/news.tsx` und `src/routes/_authenticated/admin/events.tsx`; Validierung auf `image/jpeg`, `image/png`, `application/pdf` und Größe; beim Ersetzen/Löschen wird die alte Datei aus dem Bucket entfernt.
4. **Anzeige**: neue Komponente `src/components/MediaAttachment.tsx` (Bild bzw. PDF-Kachel), eingebunden in `src/routes/news.tsx`, `src/routes/_authenticated/portal/news.tsx`, `src/routes/_authenticated/portal/events.tsx`; Selects um die neuen Spalten erweitern.
5. Speichern-Validierung: Titel plus mindestens Text oder Datei.
