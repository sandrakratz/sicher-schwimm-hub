# Familienschwimmen – Entwurf Datenschutz und Rechtliches (zur Prüfung durch den Vorstand)

Stand: 08.11.2026. Das ist **keine Rechtsberatung**, sondern ein Entwurf auf Basis von Vereins- und Verbandsquellen. Übernommen in die Datenschutzerklärung als Abschnitt 10a (08.11.2026).

## 1. Vorschlag für den Absatz in der Datenschutzerklärung

> **Familienschwimmen (nur für Vereinsmitglieder)**
> Wenn Sie sich im Mitgliederbereich für das Familienschwimmen anmelden, verarbeiten wir die Namen und Geburtsdaten der angemeldeten Familienmitglieder (aus Ihrem Mitgliedskonto), Ihre Kontaktdaten, gewünschte Termine, ggf. den Namen einer Aufsichtsperson auf der Tribüne und Ihre Anmerkung. Zweck ist die Durchführung des Angebots und die faire Vergabe der begrenzten Plätze. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Mitgliedschaftsverhältnis).
> Für die faire Vergabe führen wir je Mitgliedskonto einen Zähler (Anzahl tatsächlicher Teilnahmen, Anzahl Strafpunkte durch kurzfristige Absagen oder Nichterscheinen, Datum der letzten Teilnahme). Namen von Kindern werden dafür nicht gespeichert.
> Die Angaben sind nur für berechtigte Vorstandsmitglieder sichtbar und werden nicht an andere Mitglieder weitergegeben. Sechs Monate nach dem Termin löschen wir Namen, Geburtsdaten, Kontaktdaten, Aufsichtsperson und Anmerkungen. Der Zähler bleibt bis zum Ende der Mitgliedschaft gespeichert und wird danach gelöscht.

Zusätzlich: Eintrag ins Verzeichnis der Verarbeitungstätigkeiten (Zweck, Kategorien, Löschfrist wie oben).

## 2. Was bereits im System umgesetzt ist
- Zugriff auf Anmeldedaten nur für Vorstand/Admin (Zeilenschutz in der Datenbank, keine Teilnehmerliste für Mitglieder).
- Schreibzugriff nur serverseitig, Änderungen werden im Protokoll (Audit) festgehalten.
- Automatische Löschung der personenbezogenen Angaben 6 Monate nach dem Termin (`family_swim_scrub`, täglich).
- Pflichtbestätigungen im Formular: nur Mitglieder, Aufsichtspflicht der Eltern, Wasserzeit 45 Minuten, Bad bis 13:00 Uhr verlassen, Platzanfrage ist keine Zusage.

## 3. Aufsicht und Haftung (Einordnung)
- Beim Familienschwimmen übernimmt der Verein keine Aufsicht über die Kinder. Die Eltern bleiben aufsichtspflichtig. Das steht im Formular und in der Zusage-Mail.
- Ein pauschaler Haftungsausschluss in Standardtexten ist bei Verletzung von Leben und Gesundheit in der Regel unwirksam. Deshalb ist keiner vorgesehen.
- Der ehrenamtliche Vorstand haftet gegenüber Verein und Mitgliedern nur bei Vorsatz oder grober Fahrlässigkeit (§ 31a BGB).

## 4. Vor dem ersten Termin klären
1. **Versicherung:** Deckt die Vereinshaftpflicht und die Sportversicherung das Familienschwimmen (Kinder mit Eltern, ohne eigenen Kurs) ab? Schriftlich beim Versicherer nachfragen.
2. **Sportschule Hennef:** Wer ist für Badeaufsicht und Notfall zuständig, wenn der Übungsleiter den Nachbarkurs betreut?
3. **Übungsleiter:** Ein Übungsleiter ist laut Vorstand immer vor Ort. Das sollte als Regel im Dienstplan stehen.
4. **Datenschutzerklärung** um den Absatz oben ergänzen und im Verzeichnis der Verarbeitungstätigkeiten eintragen.

## Quellen
- [DLRG zur Aufsichtspflicht](https://sulzbach.dlrg.de/assetService/g1329/a886597/vo/DLRG%2520Aufsichtspflicht.pdf)
- [LSB Bremen: Aufsichtspflicht](https://lsb-bremen.vibss.de/vereinsmanagement/vereinsjugend/rechtsfragen-in-der-jugendarbeit/aufsichtspflicht?type=123)
- [ARAG: Haftung Vereinsvorstand](https://www.arag.de/vereinsversicherung/haftung-vereinsvorstand)
- [Sportbund Rheinhessen: Nichtmitglieder](https://sportbund-rheinhessen.vibss.de/vereinsmanagement/recht/vereinsrecht/mitglieder-des-vereins/die-nichtmitglieder?type=123)
- [Deutsches Ehrenamt: Praxisleitfaden Datenschutz](https://benedetto.deutsches-ehrenamt.de/app/uploads/2025/07/2025-07-deh-benedetto-juli-final.pdf)
