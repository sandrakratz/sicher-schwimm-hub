# Gesendeten Inhalt unter Kursanfragen korrekt anzeigen

## Ursache
Für dieselbe E-Mail existieren mehrere Protokolleinträge mit identischer Nachrichten-ID: Der erste Eintrag enthält Betreff und vollständigen Inhalt, der spätere Eintrag enthält den finalen Status „Gesendet“, aber keinen Inhalt. Die Verlaufsansicht wählt derzeit nur den neuesten Eintrag und zeigt deshalb fälschlich „Inhalt nicht gespeichert“.

## Umsetzung
1. Die Einträge pro Nachrichten-ID zusammenführen: Status, Zeitpunkt und Fehler vom neuesten Eintrag übernehmen, Betreff sowie Text-/HTML-Inhalt aus dem zugehörigen inhaltstragenden Eintrag ergänzen.
2. Diese Zusammenführung sowohl für Kursanfragen als auch für allgemeine Nachrichten verwenden, damit beide Gesprächsverläufe zuverlässig den tatsächlich versendeten Text zeigen.
3. Die Serverfunktion technisch sauber aufteilen: Laufzeit-Helfer für Berechtigung und Zusammenführung in ein serverseitiges Hilfsmodul verschieben; die Serverfunktionsdatei bleibt ein dünner Wrapper.
4. Mit dem vorhandenen Eintrag vom 18.08.2026 um 07:21 Uhr prüfen, dass anschließend „Gesendet“, der Betreff und der vollständige Eltern-Text gemeinsam angezeigt werden.

## Datenbestand
Eine Datenbankänderung oder Wiederherstellung ist nicht nötig: Der konkrete Nachrichtentext ist bereits vollständig gespeichert und wird nach der Korrektur sichtbar.
