## Logo austauschen

Das neue Logo (Biber mit Hennefer Silhouette und Schriftzug „SICHER SCHWIMMEN e.V.") ersetzt das aktuell verwendete Logo überall.

### Schritte

1. **Neues Logo als CDN-Asset registrieren**
   - Upload via `lovable-assets` aus `/mnt/user-uploads/WhatsApp_Image_2026-06-04_at_13.10.47.jpeg` → neue Datei `src/assets/logo-sicher-schwimmen-v2.jpg.asset.json`.
   - Altes Asset `src/assets/logo-sicher-schwimmen.jpg.asset.json` löschen (via `delete_asset`).

2. **Importe umstellen** in:
   - `src/components/SiteHeader.tsx`
   - `src/components/SiteFooter.tsx`
   - `src/routes/index.tsx`
   - `src/routes/auth.tsx`
   - `src/routes/_authenticated/route.tsx`
   - `src/routes/_authenticated/admin/route.tsx`

3. **Visuelle Prüfung** in Header, Footer, Login und Portal/Admin-Sidebar.

### Nicht im Scope

- Keine Layout-, Farb- oder Textänderungen.
- Keine Backend-Änderungen.
