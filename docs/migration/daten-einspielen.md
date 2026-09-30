# Datenbank einspielen (Windows)

Spielt die Lovable-Sicherung (`.backup`) in das **neue, leere** Supabase-Projekt ein. Das Skript `daten-einspielen.ps1` macht die Arbeit;
hier steht, was davor und danach zu tun ist.

## Was übernommen wird – und was nicht

| Wird übernommen | Wird nicht übernommen |
|---|---|
| alle eigenen Tabellen mit Daten, Zugriffsregeln, Funktionen | Anmelde-Sitzungen (alle müssen sich einmal neu anmelden) |
| Nutzerkonten mit Passwörtern (auth.users, auth.identities) | Zeitpläne für die täglichen Aufgaben → neu anlegen, siehe `neue-einrichtung.md`, Abschnitt 4 |
| Zugriffsregeln der Dateispeicher | hochgeladene Dateien → von Hand in Storage hochladen |
| der Auslöser auf den Nutzerkonten | ungenutzte Mail-Warteschlangen-Funktionen (pgmq), Vault |

Das Skript spielt alles in **einer Transaktion** ein: Entweder es klappt komplett oder die Datenbank bleibt unverändert. Es bricht außerdem ab,
wenn das Ziel nicht leer ist.

## Vorbereitung

1. **Ordner anlegen**, z. B. `umzug` auf dem Desktop. Hinein kommen zwei Dateien:
   - die entpackte Sicherung `sicher-schwimm-hub_260930.backup`
   - das Skript `daten-einspielen.ps1` (auf GitHub öffnen → Download-Symbol). Falls Windows die Datei blockiert: Rechtsklick → Eigenschaften → „Zulassen“ anhaken.
2. **PostgreSQL-Werkzeuge installieren:** auf postgresql.org/download/windows den Installer laden (Version **17 oder neuer**). Bei „Select Components“ **nur „Command Line Tools“** angekreuzt lassen, Server, pgAdmin und Stack Builder abwählen.
3. **Datenbank-Passwort festlegen:** Supabase → Project Settings → Database → „Reset database password“. Nur **Buchstaben und Zahlen** verwenden (Sonderzeichen machen die Adresse fehleranfällig). Notieren.
4. **Verbindungsadresse kopieren:** Supabase → oben „Connect“ → Reiter **„Session pooler“** (nicht „Direct connection“) → die Adresse (URI) kopieren und `[YOUR-PASSWORD]` durch das Passwort ersetzen.

## Ausführen

5. Im Ordner `umzug` oben in die Adresszeile des Explorers `powershell` tippen und Enter drücken. In dem blauen Fenster diese Zeile einfügen:

   `powershell -ExecutionPolicy Bypass -File .\daten-einspielen.ps1`

6. Das Skript zeigt, welche Werkzeuge es gefunden hat, fragt nach der Verbindungsadresse (die Eingabe bleibt unsichtbar), prüft das Ziel und zeigt die Auswahl.
   Zum Starten `JA` eintippen.
7. Am Ende erscheinen die Zeilenzahlen pro Tabelle. Sie stehen auch in `umzug-protokoll\zeilenzahlen.txt` (nur Namen und Zahlen).

## Wenn etwas schiefgeht

Es wurde dann **nichts** verändert, man kann nochmal starten. Das Skript zeigt die Fehlerzeilen (Zeilen mit Dateninhalt blendet es aus).
Vor dem Weitergeben bitte kurz selbst prüfen, dass keine Namen oder Adressen darin stehen. Das vollständige Protokoll `einspielen-log.txt` nicht weitergeben.

## Danach prüfen

- Supabase → Authentication → Users: Die Zahl der Nutzer passt zur Zahl `auth.users` im Ergebnis.
- Supabase → Authentication → Policies: Bei den Tabellen stehen Regeln.
- Die Sicherungsdatei erst nach Abschluss des Umzugs löschen; bis dahin nur privat aufbewahren, nicht hochladen.

## Wie das getestet wurde (und wie nicht)

Die Auswahl- und Einspiellogik wurde gegen eine nachgebaute Datenbank mit Testdaten geprüft (PostgreSQL 16): Nutzerkonten samt Passwort-Hashes kommen an,
es entstehen keine doppelten Profile durch den Auslöser, Zugriffsregeln und Zeilenschutz sind da, Systembereiche und die Mail-Warteschlange bleiben draußen,
ein nicht leeres Ziel wird erkannt. Dabei fiel eine falsche Reihenfolge auf (Konten vor Verknüpfungen), die im Skript korrigiert ist.
**Nicht getestet:** das PowerShell-Skript selbst unter Windows, die echte Sicherung (Format PostgreSQL 17) und die echte Supabase-Umgebung.
Das Ziel ist leer und das Skript arbeitet in einer Transaktion, ein Fehlversuch ist deshalb gefahrlos.
