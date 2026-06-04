## Logo austauschen

Dein hochgeladenes Logo (`Logo_SW.jpg` mit Biber, Hennefer Silhouette und Schriftzug „SICHER SCHWIMMEN e.V.") ersetzt das bisher generierte Beaver-Logo überall in der App.

### Schritte

1. **Logo als CDN-Asset registrieren**
   - `Logo_SW.jpg` über `lovable-assets` hochladen → erzeugt `src/assets/logo-sicher-schwimmen.jpg.asset.json`.
   - Das alte `src/assets/logo-beaver.png` aus dem Code entfernen (Datei kann liegen bleiben oder gelöscht werden).

2. **Importe & Verwendungen umstellen**
   In folgenden Dateien den Import auf das neue Asset umstellen:
   - `src/components/SiteHeader.tsx` (öffentliche Navigation)
   - `src/components/SiteFooter.tsx` (Footer)
   - `src/routes/index.tsx` (Startseite/Hero)
   - `src/routes/auth.tsx` (Login)
   - `src/routes/_authenticated/route.tsx` (Mitgliederportal-Sidebar)
   - `src/routes/_authenticated/admin/route.tsx` (Admin-Sidebar)

3. **Darstellung anpassen**
   Da das neue Logo bereits den Schriftzug „SICHER SCHWIMMEN e.V." enthält:
   - In Header/Sidebars den separaten Text-Schriftzug neben dem Logo entweder entfernen oder verkleinern (sonst doppelt).
   - Logo-Größen leicht anheben (z. B. Header von 40 px auf ~56 px), weiß-runde Hintergrund-Maske entfernen (Logo hat schon transparenten/weißen Hintergrund).
   - Favicon (`index.html`) ebenfalls auf das neue Logo umstellen.

4. **Visuelle Prüfung**
   - Startseite, Login, Portal und Admin-Bereich in der Preview kontrollieren (Schärfe, Proportionen, kein doppelter Schriftzug).

### Nicht im Scope

- Keine Änderungen an Farbschema, Typografie oder Layout.
- Keine Backend-/Datenbankänderungen.

Soll ich es so umsetzen?