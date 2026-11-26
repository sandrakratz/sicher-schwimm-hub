- Volljährigkeits-Bestätigung läuft über geheimen Token-Link (majority_confirmations), Schreibzugriff nur serverseitig – kein Login für Jugendliche ohne Konto nötig.

## Bedienregeln Verwaltung (`/admin`)

Gelten für jede neue oder geänderte Seite im Verwaltungsbereich:

1. Jeder Knopf sagt mit Text, was er tut; reine Symbole nur für Allgemeines (Schließen, Kopieren).
2. Pro Zeile höchstens zwei sichtbare Knöpfe, der Rest unter „Weitere ▾“ (`src/components/admin/MoreMenu.tsx`, jede Aktion mit einem Satz zur Folge).
3. Endgültiges Löschen steht zuletzt im Menü „Weitere“, rot, mit Folge-Satz; die weiche Alternative (abmelden, beenden, archivieren, „fällt aus“) steht vorn. Löschen nur für Fehleinträge.
4. Auswahllisten wählen nur aus, ausgelöst wird per Knopf; Status wird angezeigt, nicht per Select geändert.
5. Vor Aktionen mit Folgen (Mail, Sperre, Geld, Löschen) ein eigenes Fenster „Das passiert“ (`src/components/admin/ConfirmActionDialog.tsx`) – kein `confirm()`/`prompt()`.
6. Wer etwas beendet, gibt einen Grund an; er bleibt mit Datum sichtbar.
7. Jede Aktion meldet sich zurück, Rückgängig wo möglich.
8. Graue Knöpfe erklären, was fehlt.
9. Ein Wort pro Vorgang, Menüpunkt = Seitentitel. Ansprache: Verwaltung und Trainer:innen „du“, Eltern und Mitglieder „Sie“.
10. Ein Kind, eine Familie, ein Ort: Suche in der Seitenleiste (`AdminSearchBox`), Treffer führen in die Familienakte.

Wortliste: Absage erfassen (Familie, zählt als Absage) · Abmelden / „Abgemeldet“ (Warteliste) · Aus dem Kurs nehmen (Verein, Buchung bleibt) · Ablehnen und sperren · Kurs absagen (nur vor Beginn) · Termin fällt aus · Mitgliedschaft beenden · Sperre aufheben / Verlängern · Wieder auf die Warteliste · Löschen (nur Fehleintrag) · Postfach · Änderungsprotokoll · Nachrichten senden.

Löschfristen und Löschjobs: `docs/loeschkonzept.md`. Kinder und Mitgliedschaften werden nicht hart gelöscht, sondern beendet bzw. herausgenommen; gelöscht wird nach Frist.
