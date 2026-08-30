# Prüfbericht Website – Fehler, Doppelungen, Verbesserungen

Geprüft: alle öffentlichen Seiten (Live-Test im Browser auf Handy 390px und Desktop 1280px), Mitglieder-/Verwaltungsbereich, Navigation und Rollenrechte, Formulare, Sicherheits-Scan, Abhängigkeits-Scan, Build- und Fehlerprotokolle.

Gute Nachricht vorweg: Build läuft fehlerfrei, alle 16 öffentlichen Seiten laden mit Status 200, keine JavaScript-Fehler in der Konsole, keine toten internen Links, keine kritischen Sicherheitslücken oder verwundbaren Pakete.

---

## A. Fehler, die behoben werden sollten

**Hoch**
1. Horizontaler Überlauf auf dem Handy (Seite lässt sich seitlich wegschieben):
   - `/kursbedingungen` – Inhalt 494px breit bei 390px Bildschirm (stärkster Überlauf)
   - `/ueber-uns` – 425px (Kacheln im oberen Bereich)
   - `/datenschutz` – 401px
   - `/mitgliedsordnung` – Beitrags-Tabelle ohne seitliches Scrollen
2. Rechteprüfung fehlt auf Seitenebene bei drei Verwaltungsseiten: `admin/benutzer.tsx`, `admin/sperrliste.tsx`, `admin/verfuegbarkeit.tsx` haben kein `beforeLoad`. Serverseitig wird zwar geprüft, aber z. B. ein Trainer kann die Sperrlisten-Seite öffnen und bekommt statt einer sauberen Weiterleitung nur Fehler/leere Daten.
3. Sicherheits-Scan (neu, offen): Trainer können bei `course_sessions` Termine beliebiger Kurse anlegen/ändern und sich selbst als Trainer eintragen, weil die Schreibregeln nicht auf „eigener Kurs“ eingeschränkt sind.

**Mittel**
4. Fehler werden still verschluckt (keine Meldung für den Nutzer/Admin):
   - `CourseRequestsAdmin.tsx:195` (Kurs-Vorschlag), `admin/kurse.tsx:226,371`, `verfuegbarkeit.tsx:186`
   - `verfuegbarkeit.tsx` lädt Termine ohne Fehlerbehandlung → bei Ladefehler sieht der Trainer „keine Termine“ statt einer Fehlermeldung
   - `kontakt.tsx:85`, `kurs-anfragen.tsx:83`: schlägt die Admin-Benachrichtigung fehl, bekommt der Besucher trotzdem „erfolgreich gesendet“
5. Breite Tabellen ohne seitliches Scrollen im Adminbereich: `mitglieder.tsx`, `mitgliedschaften.tsx`, `sperrliste.tsx`, `versandstatus.tsx`, beide Tabellen in `CourseRequestsAdmin.tsx` – auf Tablet/Handy nicht bedienbar.
6. Dialoge ohne Höhenbegrenzung/Scrollen: `benutzer.tsx:200`, `dokumente.tsx:162`, `events.tsx:141`, `nachrichten.tsx:181`, `widerrufe.tsx:211` – Inhalt wird auf kleinen Bildschirmen abgeschnitten.
7. `TestSendDialog.tsx:42` schreibt ohne Absicherung in den Browser-Speicher – im privaten Modus bricht der Testversand ab.

**Niedrig**
8. `mitgliedschaft.tsx:381-387` und `kurs-anfragen.tsx:191` verlinken Satzung/Datenschutz per `<a href>` → kompletter Seiten-Neuladen statt schneller Navigation.
9. `/unsubscribe` hat keine Seiten-Metadaten (Titel/Beschreibung).

---

## B. Doppelungen und Überflüssiges

**Mittel**
10. Bankverbindung zweimal ausprogrammiert: `kurse.tsx:141-154` und `kurse_.$slug.tsx:176-186` – zudem einmal „Kontoinhaber“, einmal „Empfänger“ für dasselbe Feld.
11. Preisformatierung `fmtPrice()` doppelt in `kurse.tsx:50` und `kurse_.$slug.tsx:66` – gehört nach `src/lib/format.ts`.
12. Status-Farblogik für Kurstermine zweimal unterschiedlich umgesetzt (`kurse.tsx:83-88` vs. `kurse_.$slug.tsx:108-114`).
13. KI-Bild-Hinweis wortgleich dreimal (`index.tsx:180`, `kurse.tsx:166`, `ueber-uns.tsx:37`).
14. Kontaktdaten doppelt gepflegt in `kontakt.tsx:119-135` und `SiteFooter.tsx:40-47`, mit abweichender Formulierung.
15. Beiträge (60 €/96 €) stehen an drei Stellen fest im Text (`mitgliedschaft.tsx`, `faq.tsx`, Meta-Beschreibung) – Gefahr, dass sie bei einer Änderung auseinanderlaufen.
16. Kalender-/Zeitzonenlogik (~130 Zeilen ICS-Erzeugung) liegt komplett in `verfuegbarkeit.tsx` statt in einem gemeinsamen Modul.

---

## C. Fehlende Bestandteile

**Mittel**
17. Spam-Schutz uneinheitlich: `widerruf.tsx` und die Direktbuchung haben ein Honeypot-Feld, `kontakt.tsx`, `kurs-anfragen.tsx` und `mitgliedschaft.tsx` nicht – das sind genau die am häufigsten missbrauchten Formulare.
18. Feldbezogene Fehlermeldungen nur bei `widerruf.tsx`; alle anderen Formulare zeigen nur einen Toast, das Feld selbst bleibt unmarkiert (z. B. Passwortbestätigung in `mitgliedschaft.tsx:93`).
19. Kursdetailseite `kurse_.$slug.tsx` hat keine `canonical`-Angabe und kein `og:url` – schlechter für Suchmaschinen und Teilen-Vorschauen.

**Niedrig**
20. Ladebuttons ohne Spinner/`aria-busy` (alle öffentlichen Formulare) – nur Textwechsel.
21. Kein Fehlerzustand in `admin/mitglieder.tsx` beim Laden.

---

## D. Verbesserungsmöglichkeiten (Bedienung, Text, Gestaltung)

**Mittel**
22. Vier verschiedene Bezeichnungen für denselben Weg: „Auf Warteliste setzen“, „Für Warteliste anfragen“, „Warteliste anfragen“, „Kurs anfragen“ – für Besucher unklar, ob das dasselbe ist.
23. Elternname mal als ein Feld („Name Erziehungsberechtigte:r“ in `kurse_.$slug.tsx:313`), mal getrennt in Vor-/Nachname (`mitgliedschaft.tsx`, `widerruf.tsx`).
24. Feste Farbwerte statt Design-Token: `mitgliedschaft.tsx:200-219` (grün/amber), `widerruf.tsx:156` (emerald) – bricht das einheitliche Farbsystem.
25. Klickfläche der Checkbox in `widerruf.tsx:344-357` nur 16px, anderswo ist die ganze Zeile klickbar.

**Niedrig**
26. Startseite: dekorativer Farbkreis ragt über den Rand hinaus (`index.tsx`, Hero) – aktuell folgenlos, aber unsauber.
27. Startseite-Hero springt zwischen 768–1024px abrupt aufs Einspaltenlayout.
28. `text-white` in allen Hero-Bereichen statt eines Tokens `hero-foreground`; `theme-color`-Hex in `__root.tsx:81` doppelt zur Primärfarbe gepflegt.

---

## E. Nicht zu beanstanden

- Keine toten Links, keine Debug-/Altdateien, keine `console.log`-Reste.
- Rollenlogik in `nav-items.ts` deckt sich mit den Route-Guards (bis auf Punkt 2).
- Warteliste/Anfragen teilen sich korrekt eine Komponente.
- Keine hoch-/kritisch eingestuften Paket-Schwachstellen; Build sauber.

---

## Vorschlag für die Umsetzung (nach Freigabe)

- **Schritt 1 (hoch):** Punkte 1, 2, 3, 5, 6 – Handy-Überläufe, fehlende Route-Guards, Trainer-Schreibrechte, Tabellen-/Dialog-Responsivität.
- **Schritt 2 (mittel):** Punkte 4, 10–17, 22–25 – Fehlermeldungen, Doppelungen zusammenführen, Honeypots, einheitliche Begriffe und Farbtoken.
- **Schritt 3 (niedrig):** Punkte 8, 9, 19–21, 26–28 – Feinschliff, SEO-Ergänzungen, Ladezustände.

Es wurden bislang keinerlei Änderungen vorgenommen. Sag mir bitte, ob ich alle drei Schritte umsetzen soll oder nur einen bestimmten.
