# Weitere Verbesserungsvorschläge

Aus der Gesamtprüfung sind noch vier Punkte offen. Sie sind nach Nutzen sortiert –
du kannst einzelne davon auswählen, es muss nicht alles umgesetzt werden.

## 1. Ein Posteingang statt zwei (empfohlen)

Heute gibt es zwei getrennte Orte für Nachrichten: „Nachrichten" (Kontaktformular)
und die Antwort-Verläufe innerhalb der Wartelisten-/Anfragen-Seite. Wer eine Antwort
sucht, muss an zwei Stellen schauen.

Vorschlag: Die Seite „Nachrichten" zeigt zusätzlich die Verläufe aus Warteliste und
Kursanfragen, mit Filter „Kontaktformular / Warteliste / Kursanfrage". Antworten
funktioniert überall gleich. Die Verläufe bleiben zusätzlich beim jeweiligen Eintrag
sichtbar.

## 2. Anwesenheit an einer Stelle

Trainer tragen heute zwei getrennte Listen: Anwesenheit der Kinder und die eigene
Anwesenheit. Beide erfassen pro Termin dasselbe (da / nicht da / Notiz).

Vorschlag: Ein gemeinsamer Block pro Termin – oben „Wer war als Trainer da?",
darunter die Kinder. Die Steuer-Auswertungen bleiben unverändert, es ändert sich nur
die Bedienung.

## 3. Kursverwaltung entlasten

Die Kursseite im Adminbereich ist sehr lang (Kursdaten, Termine, Teilnehmer,
Zahlungen, Exporte in einer Ansicht).

Vorschlag: Aufteilung in Reiter „Kursdaten", „Termine", „Teilnehmer & Zahlungen",
„Exporte". Gleiche Funktionen, kürzere Wege, weniger Scrollen.

## 4. Startseite des Adminbereichs als Arbeitsliste

Heute stehen dort Zahlen. Nützlicher wären anklickbare Aufgaben: „3 Zahlungen
überfällig", „2 Wartelisten-Angebote laufen morgen ab", „1 Mitgliedsantrag offen",
„Termine morgen ohne Trainer". Jede Zeile führt direkt an die richtige Stelle.

## Kleinere Punkte

- Der Hinweis auf der Sperrliste verweist noch auf den alten Menüpunkt „Kursanfragen" –
  Text auf „Warteliste & Anfragen" anpassen.
- Telefonnummern und Adressen im Profil als führende Quelle kennzeichnen, damit klar
  ist, wo Eltern ihre Daten ändern.

## Technische Hinweise

- Punkt 1: `src/routes/_authenticated/admin/nachrichten.tsx` liest `messages`;
  die Verläufe kommen aus `src/lib/conversation.server.ts` und
  `src/lib/waitlist-reply.functions.ts`. Zusammenführung über eine gemeinsame
  Server-Funktion, die beide Quellen in ein einheitliches Format bringt.
- Punkt 2: `src/lib/attendance.functions.ts` und
  `src/lib/trainer-attendance.functions.ts` bleiben als Datenquellen bestehen;
  zusammengeführt wird nur die Oberfläche in
  `src/routes/_authenticated/trainer/kurse.tsx` (`AttendanceBoard` +
  `TrainerAttendancePanel`). Keine Migration nötig.
- Punkt 3: reine UI-Umstrukturierung von
  `src/routes/_authenticated/admin/kurse.tsx` (~1670 Zeilen) mit `Tabs`.
- Punkt 4: neue Server-Funktion, die die vorhandenen Abfragen aus
  `admin/index.tsx` um Fälligkeiten und Termine ohne Trainer ergänzt.
