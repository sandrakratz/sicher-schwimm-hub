# Anmelde-Einstellungen

Stand: 30.09.2026.

## Was NICHT direkt ausgelesen werden konnte
Site-URL, erlaubte Weiterleitungs-Adressen und der Schalter „E-Mail-Bestätigung Pflicht" sind Projekteinstellungen des Anmeldedienstes. Auf Lovable Cloud gibt es dafür keinen lesenden Zugriff (kein Dashboard, `supabase/config.toml` enthält nur die Projekt-ID). Diese Werte bitte beim Umzug neu festlegen.

Aus Code und Projektvorgaben ableitbar:
- **Site-URL (vermutlich):** https://sicher-schwimmen.com (Custom Domain; weitere: https://www.sicher-schwimmen.com, https://sicher-schwimm-hub.lovable.app)
- **Weiterleitungen im Code:** `/reset-password` (Passwort zurücksetzen) sowie `window.location.origin` nach Anmeldung. Diese Adressen müssen für alle Domains erlaubt werden.
- **E-Mail-Bestätigung:** Projektvorgabe ist „kein Auto-Confirm" → Bestätigung per E-Mail vermutlich Pflicht (nicht verifiziert). Zusätzlich gibt es eine app-eigene Freischaltung von Mitgliedskonten durch Admins.

## Aktive Anmeldearten
- **E-Mail + Passwort:** aktiv. In der Datenbank (`auth.identities`) kommt ausschließlich der Anbieter `email` vor.
- Google oder andere Anbieter: keine Nutzer damit vorhanden; ob sie in den Einstellungen eingeschaltet sind, konnte nicht geprüft werden.

## E-Mail-Hook
Ja, ein Auth-E-Mail-Hook ist eingerichtet: Die Anmelde-Mails (Bestätigung, Passwort-Reset usw.) laufen über den Webhook `src/routes/lovable/email/auth/webhook.ts` und werden mit eigenen Vorlagen von `noreply@notify.sicher-schwimmen.com` versendet. Dieser Hook ist Lovable-spezifisch und muss beim Umzug durch einen eigenen SMTP-/Hook-Versand ersetzt werden.
