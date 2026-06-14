## Ziel

Reihenfolge erzwingen: zuerst Mitgliedsantrag, dann (optional sofort) Kontoanlage. Freie Registrierung auf `/auth` wird gesperrt, neue Konten entstehen ausschließlich aus dem Mitgliedsantrag-Flow heraus.

## Änderungen

### 1. `/auth` — Registrierung sichtbar, aber gesperrt
- Bestehende Tabs „Anmelden | Registrieren" bleiben.
- Im Tab „Registrieren" wird das Formular durch eine Hinweis-Card ersetzt:
  > „Eine Registrierung ist nur über einen Mitgliedsantrag möglich. Bitte stellen Sie zuerst Ihren Mitgliedsantrag — direkt im Anschluss können Sie Ihr Konto anlegen."
  - Button „Zum Mitgliedsantrag" → `/mitgliedschaft`.
- Bestehender `signUp`-Code und `signupDone`-Dialog werden entfernt (Dead Code), damit niemand das Formular per DevTools nutzen kann.
- „Passwort vergessen" bleibt unverändert verfügbar.

### 2. `/mitgliedschaft` — Konto-Erstellung im Erfolgsdialog
- Nach erfolgreichem Insert öffnet wie bisher der `AlertDialog` „Mitgliedsantrag eingegangen".
- Neuer Inhalt im Dialog: zusätzlicher Abschnitt **„Konto anlegen (optional, empfohlen)"** mit
  - vorbelegtem, schreibgeschütztem E-Mail-Feld (`parsed.data.email`),
  - zwei Passwortfeldern (`password`, `password_confirm`, min. 8 Zeichen),
  - Button **„Konto erstellen"** → `supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/portal", data: { first_name, last_name } } })`.
- Erfolg: Statusmeldung „Konto wurde angelegt. Bitte bestätigen Sie Ihre E-Mail-Adresse. Die Freischaltung erfolgt durch einen Admin." + Button „OK".
- Bei Fehler `User already registered`: freundlicher Hinweis „Für diese E-Mail existiert bereits ein Konto" + Link „Zum Login".
- Sekundär-Button „Überspringen / Schließen" bleibt — Antrag ist ja schon gespeichert.

### 3. Admin-Benachrichtigung
- Bestehender `notify-admin` Aufruf (Template `membership-application`) bleibt unverändert.
- Die separate `new-registration`-Mail (aus `auth.tsx`) entfällt ersatzlos — sie wurde nur vom alten Registrierungs-Flow getriggert; der Mitgliedsantrag deckt das ab.

### 4. Keine Backend-/Policy-Änderungen
- `auth.signUp` bleibt serverseitig erlaubt (Supabase Auth Setting wird **nicht** auf `disable_signup` gestellt), sonst würde der Mitgliedsantrag-Flow scheitern.
- Schutz „nur über Antrag" ist eine UI-Konvention; Power-User könnten technisch noch `auth.signUp` aufrufen — das ist akzeptabel, da die Admin-Freischaltung über Rollen/Mitgliedschaft den Zugriff aufs Portal weiterhin steuert.

## Dateien

- `src/routes/auth.tsx` — Registrierungs-Tab durch Hinweis-Card ersetzen, Signup-Code/`signupDone`-Dialog entfernen.
- `src/routes/mitgliedschaft.tsx` — Erfolgsdialog erweitern: optionaler „Konto anlegen"-Block mit Passwortfeldern + `supabase.auth.signUp`.

## Verifikation

- `/auth` → Tab „Registrieren": zeigt Hinweis + Link, kein Formular.
- `/mitgliedschaft` ausfüllen → Dialog erscheint, Passwort setzen → Konto wird in `auth.users` angelegt, Bestätigungs-E-Mail geht raus, Admin-Mail für Antrag kommt an.
- Mit bereits existierender E-Mail im Antrag: Antrag wird gespeichert, Konto-Schritt zeigt freundlichen Fehler.
