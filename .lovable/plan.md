## 1) Passwort vergessen versendet keine E-Mail

**Befund:** Im `email_send_log` taucht **keine einzige** `recovery`-/`signup`-Zeile auf, obwohl `POST /recover` in den Auth-Logs mit Status 200 erfolgreich war. Das bedeutet: Der Supabase-Auth-Hook ruft unseren `/lovable/email/auth/webhook` aktuell **nicht** auf — Auth-Mails (Passwort-Reset, Bestätigung etc.) werden also über keinen funktionsfähigen Pfad zugestellt.

**Vorgehen:**
- Status der E-Mail-Domain und der Auth-Hook-Aktivierung prüfen (`check_email_domain_status`).
- Auth-Templates neu registrieren (`scaffold_auth_email_templates` mit `confirm_overwrite: true`) — das aktiviert den Send-Email-Hook in Supabase neu, ohne die vorhandenen Templates inhaltlich zu verändern (sie werden danach wieder mit unserem Branding überschrieben, sofern nötig).
- Nach Republish einen Recovery-Test laufen lassen und `email_send_log` (`template_name='recovery'`) sowie ggf. die DLQ kontrollieren.

Am Code (Templates, Webhook) ist nichts kaputt — nötig ist nur die Re-Aktivierung der Verknüpfung.

## 2) Automatische Kontoanlage nach Mitgliedsantrag (inaktiv bis Freigabe)

**Heute:** Im Erfolgs-Dialog kann der Antragsteller optional ein Passwort setzen und damit selbst per `supabase.auth.signUp` ein Konto anlegen. Wer das überspringt, hat kein Konto.

**Soll:** Konto wird **immer** sofort beim Absenden des Antrags angelegt und steht auf „pending", bis ein Admin es freigibt. Passwort darf leer bleiben — dann setzt der Admin später per Einladung/Recovery ein Passwort.

**Wichtige Einschränkung:** Supabase Auth erlaubt **kein leeres Passwort**. Lösung: Wenn der Antragsteller kein Passwort eingibt, generieren wir serverseitig ein kryptographisch zufälliges Einmal-Passwort, das nie zurückgegeben wird. Der Nutzer kommt später ausschließlich über „Passwort vergessen" oder eine Admin-Einladung in sein Konto.

**Änderungen:**

a) **Neue Server-Funktion `src/lib/membership-signup.functions.ts`** (öffentlich, kein Auth nötig — sie wird vom Antragsformular aufgerufen):
   - Input (Zod-validiert): `email`, `first_name`, `last_name`, optional `password` (min. 8 Zeichen, max. 72).
   - Lädt `supabaseAdmin` lazy im Handler.
   - Prüft, ob bereits ein `auth.users`-Eintrag mit dieser E-Mail existiert (per `admin.listUsers` / `getUserByEmail`).
     - Wenn ja: nichts neu anlegen, nur Status `"exists"` zurückgeben — `handle_new_user`-Trigger und die existierende Verknüpfungslogik bleiben unberührt.
   - Andernfalls: `supabaseAdmin.auth.admin.createUser({ email, password: password ?? randomBytes(32).toString('base64url'), email_confirm: false, user_metadata: { first_name, last_name } })`.
     - `email_confirm: false` sorgt dafür, dass Supabase die Standard-Signup-Bestätigungs-E-Mail auslöst (über den dann reparierten Auth-Hook → unser angepasstes `signup`-Template, das bereits den Hinweis „Freischaltung durch Vorstand" enthält).
   - Danach `profiles.status = 'pending'` setzen (per Update auf die durch `handle_new_user` automatisch erzeugte Profilzeile).
   - Rückgabe: `{ status: 'created' | 'exists' | 'created_no_password' }` für die UI.

b) **`src/routes/mitgliedschaft.tsx`** anpassen:
   - Im Formular **vor** dem Absenden zwei optionale Felder „Passwort (optional)" und „Passwort wiederholen" anbieten — mit Hinweis „Leer lassen, wenn der Vorstand das Konto später freischalten/einladen soll".
   - In `onSubmit` nach erfolgreichem `memberships.insert` direkt die neue Server-Funktion aufrufen.
   - Erfolgsdialog umbauen: Statt des bisherigen „Konto anlegen"-Blocks zeigen wir nur noch eine Statusmeldung:
     - `created`: „Konto angelegt. Bitte E-Mail bestätigen — die Freischaltung erfolgt anschließend durch den Vorstand."
     - `created_no_password`: zusätzlich Hinweis: „Sie erhalten nach Freischaltung eine Einladung mit Link zum Setzen Ihres Passworts."
     - `exists`: Hinweis „Es existiert bereits ein Konto" + Link zu `/auth`.
   - Die States `password`, `passwordConfirm`, `signupResult` und die separate `onCreateAccount`-Logik entfallen.

c) **Bestehender Login-Gate** in `src/routes/auth.tsx` greift weiterhin: `profile.status !== 'active'` blockiert Login mit Hinweis „wartet auf Freischaltung". Keine Änderung nötig.

d) **Admin-Freischaltung** unter `/admin/benutzer` setzt `profiles.status = 'active'`. Falls dort noch keine Möglichkeit existiert, einem Konto ohne Passwort eine Einladung/Passwort-Reset-Mail zu senden, ergänze ich einen Button „Einladung senden" (`supabase.auth.resetPasswordForEmail` mit Redirect auf `/reset-password`) — abhängig vom heutigen Stand der Seite (prüfe ich beim Umsetzen).

## Reihenfolge der Umsetzung
1. Auth-E-Mails reparieren (Punkt 1) — sonst funktioniert auch die neue Signup-Bestätigung nicht.
2. Server-Funktion + Formular-Umbau (Punkt 2a/2b).
3. Admin-Button „Einladung senden", falls fehlt (Punkt 2d).
4. End-to-End-Test: Antrag ohne Passwort → Konto pending → Login blockiert → Admin aktiviert → Einladung → Passwort setzen → Login.
