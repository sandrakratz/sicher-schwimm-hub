# Datenumzug: Lovable-Cloud-Sicherung (.backup) -> neues Supabase-Projekt
# Für Windows PowerShell. Aufruf siehe docs/migration/daten-einspielen.md.
#
# Was das Skript macht:
#  1. prüft, dass die PostgreSQL-Werkzeuge (Version 17 oder neuer) installiert sind
#  2. prüft, dass das Ziel eine LEERE Supabase-Datenbank ist (sonst bricht es ab)
#  3. wählt aus der Sicherung nur aus, was wir brauchen:
#       - alle eigenen Tabellen, Regeln, Funktionen usw. (Bereich "public")
#       - die Nutzerkonten (auth.users, auth.identities) samt Passwörtern
#       - die Regeln für die Dateispeicher (storage.objects)
#       - den Auslöser auf auth.users
#     NICHT übernommen wird: von Supabase verwaltetes (Sitzungen, Zeitpläne, Vault, Speicher-Einträge)
#       und die ungenutzten Mail-Warteschlangen-Funktionen (pgmq).
#  4. spielt alles in EINER Transaktion ein: entweder es klappt komplett oder es ändert sich nichts.

$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$work = Join-Path $PSScriptRoot 'umzug-protokoll'
New-Item -ItemType Directory -Force -Path $work | Out-Null

function Stop-Hier($text) {
    Write-Host ''
    Write-Host "ABBRUCH: $text" -ForegroundColor Red
    exit 1
}

# --- 1. Werkzeuge finden ---------------------------------------------------------------------
function Find-Tool($name) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $dirs = Get-ChildItem 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue |
        Sort-Object { [int]($_.Name -replace '\D', '') } -Descending
    foreach ($d in $dirs) {
        $p = Join-Path $d.FullName "bin\$name.exe"
        if (Test-Path $p) { return $p }
    }
    return $null
}
$pgRestore = Find-Tool 'pg_restore'
$psql = Find-Tool 'psql'
if (-not $pgRestore -or -not $psql) {
    Stop-Hier 'pg_restore/psql nicht gefunden. Bitte die PostgreSQL-Kommandozeilenwerkzeuge (Version 17 oder neuer) installieren, siehe Anleitung.'
}
$version = (& $pgRestore --version) -join ' '
if ($version -notmatch '(\d+)\.\d+') { Stop-Hier "Version von pg_restore nicht lesbar: $version" }
if ([int]$Matches[1] -lt 17) { Stop-Hier "pg_restore ist zu alt ($version). Die Sicherung braucht Version 17 oder neuer." }
Write-Host "Werkzeuge gefunden: $version" -ForegroundColor Green

# --- 2. Sicherungsdatei und Ziel ------------------------------------------------------------
$backup = Get-ChildItem -Path $PSScriptRoot -Filter '*.backup' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($backup) { $backupPath = $backup.FullName } else { $backupPath = (Read-Host 'Pfad zur .backup-Datei').Trim('"') }
if (-not (Test-Path $backupPath)) { Stop-Hier "Datei nicht gefunden: $backupPath" }
Write-Host "Sicherung: $backupPath"

Write-Host ''
Write-Host 'Verbindungsadresse des NEUEN Supabase-Projekts einfügen (Session pooler, mit eingesetztem Passwort).'
Write-Host 'Die Eingabe bleibt unsichtbar.'
$secure = Read-Host 'Verbindungsadresse' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$conn = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
if ($conn -notmatch '^postgres(ql)?://') { Stop-Hier 'Die Adresse muss mit postgresql:// beginnen.' }
if ($conn -match '\[YOUR-PASSWORD\]') { Stop-Hier 'In der Adresse steht noch [YOUR-PASSWORD]. Bitte dein Datenbank-Passwort einsetzen.' }

function Sql($query) {
    $out = & $psql $conn -X -At -v ON_ERROR_STOP=1 -c ($query -replace '\s+', ' ') 2>&1
    if ($LASTEXITCODE -ne 0) { return $null }
    return ($out -join "`n").Trim()
}

$db = Sql 'select current_database()'
if (-not $db) { Stop-Hier 'Keine Verbindung zur Datenbank. Adresse und Passwort prüfen (Session pooler, Passwort ohne Sonderzeichen).' }
Write-Host "Verbindung OK (Datenbank: $db)" -ForegroundColor Green

$tables = Sql "select count(*) from information_schema.tables where table_schema = 'public'"
$users = Sql 'select count(*) from auth.users'
if ($tables -ne '0' -or $users -ne '0') {
    Stop-Hier "Das Ziel ist nicht leer (Tabellen in public: $tables, Nutzerkonten: $users). Aus Sicherheitsgründen spielt das Skript nur in eine leere Datenbank ein."
}
$ext = Sql "select count(*) from pg_extension where extname in ('pg_cron','pg_net')"
if ($ext -ne '2') {
    Write-Host 'Hinweis: pg_cron und pg_net sind noch nicht beide eingeschaltet (Database > Extensions). Das ist fürs Einspielen egal, aber vor den täglichen Aufgaben nötig.' -ForegroundColor Yellow
}

# --- 3. Auswahl aus der Sicherung ------------------------------------------------------------
$toc = & $pgRestore -l $backupPath
if ($LASTEXITCODE -ne 0) { Stop-Hier 'Die Sicherung konnte nicht gelesen werden.' }

$pattern = '^(?<id>\d+); \d+ \d+ (?<type>(?:[A-Z]+ )+)(?<schema>[a-z_][a-z0-9_]*|-) (?<rest>.*)$'
$keep = New-Object System.Collections.Generic.List[string]
foreach ($line in $toc) {
    if ($line -notmatch $pattern) { continue }
    $type = $Matches['type'].Trim()
    $schema = $Matches['schema']
    $rest = $Matches['rest']
    $take = $false
    if ($schema -eq 'public') {
        # alles aus dem eigenen Bereich, außer den ungenutzten Mail-Warteschlangen-Funktionen (brauchen pgmq)
        if ($rest -notmatch '^(enqueue_email|read_email_batch|delete_email|move_to_dlq)\(') { $take = $true }
    }
    elseif ($schema -eq 'auth' -and $type -eq 'TABLE DATA' -and $rest -match '^(users|identities) ') { $take = $true }
    elseif ($schema -eq 'auth' -and $type -eq 'TRIGGER' -and $rest -match '^users ') { $take = $true }
    elseif ($schema -eq 'storage' -and $type -eq 'POLICY' -and $rest -match '^objects ') { $take = $true }
    if ($take) { $keep.Add($line) }
}
# Reihenfolge erzwingen: Nutzerkonten (users) müssen VOR ihren Verknüpfungen (identities) eingespielt werden,
# sonst verletzt das die Fremdschlüssel der Anmeldung.
$iUsers = -1; $iIdent = -1
for ($i = 0; $i -lt $keep.Count; $i++) {
    if ($keep[$i] -match ' TABLE DATA auth users ') { $iUsers = $i }
    elseif ($keep[$i] -match ' TABLE DATA auth identities ') { $iIdent = $i }
}
if ($iUsers -ge 0 -and $iIdent -ge 0 -and $iIdent -lt $iUsers) {
    $tmp = $keep[$iUsers]; $keep[$iUsers] = $keep[$iIdent]; $keep[$iIdent] = $tmp
}
$listFile = Join-Path $work 'auswahl.txt'
[System.IO.File]::WriteAllLines($listFile, $keep, (New-Object System.Text.UTF8Encoding $false))

$dataPublic = ($keep | Where-Object { $_ -match ' TABLE DATA public ' }).Count
$dataAuth = ($keep | Where-Object { $_ -match ' TABLE DATA auth ' }).Count
Write-Host ''
Write-Host "Ausgewählt: $($keep.Count) von $($toc.Count) Einträgen"
Write-Host "  Tabellen mit Daten in public: $dataPublic   Nutzerkonten-Tabellen: $dataAuth (erwartet: 2)"
if ($dataPublic -eq 0 -or $dataAuth -ne 2) { Stop-Hier 'Die Auswahl sieht unplausibel aus. Bitte die Datei umzug-protokoll\auswahl.txt an Claude schicken (enthält nur Namen, keine Daten).' }

Write-Host ''
$answer = Read-Host "Jetzt in '$db' einspielen? Zum Starten JA eintippen"
if ($answer -ne 'JA') { Stop-Hier 'Nicht bestätigt, es wurde nichts verändert.' }

# --- 4. Einspielen ---------------------------------------------------------------------------
$log = Join-Path $work 'einspielen-log.txt'
Write-Host 'Spiele ein ... (kann einige Minuten dauern)'
& $pgRestore --dbname=$conn --use-list=$listFile --no-owner --no-privileges --single-transaction --verbose $backupPath *> $log
$code = $LASTEXITCODE

if ($code -ne 0) {
    Write-Host ''
    Write-Host 'Das Einspielen ist fehlgeschlagen. Es wurde NICHTS verändert (alles in einer Transaktion).' -ForegroundColor Red
    Write-Host 'Fehlermeldungen (Zeilen mit Daten-Inhalten sind ausgeblendet; bitte trotzdem kurz prüfen, bevor du sie weitergibst):'
    Get-Content $log | Where-Object { $_ -match 'error|ERROR|Fehler' -and $_ -notmatch 'DETAIL|CONTEXT|Failing row|Kontext' } | Select-Object -First 15
    Write-Host "Vollständiges Protokoll (kann Daten enthalten, nicht weitergeben): $log"
    exit 1
}

# --- 5. Kontrolle ----------------------------------------------------------------------------
Write-Host ''
Write-Host 'Fertig. Zeilenzahlen im neuen Projekt:' -ForegroundColor Green
$counts = Sql "select table_name || ': ' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name"
$usersNow = Sql 'select count(*) from auth.users'
$result = @($counts, "auth.users: $usersNow") -join "`n"
Write-Host $result
[System.IO.File]::WriteAllText((Join-Path $work 'zeilenzahlen.txt'), $result, (New-Object System.Text.UTF8Encoding $false))
Write-Host ''
Write-Host "Die Zeilenzahlen stehen auch in: $work\zeilenzahlen.txt (nur Tabellennamen und Zahlen, keine Personendaten)."
