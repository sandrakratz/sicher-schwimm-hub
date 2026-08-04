# Kontoverbindung auf der Webseite ergänzen

Die Bankverbindung des Vereins wird zentral hinterlegt und an den Stellen angezeigt, an denen Kursbuchende sie brauchen.

## Bankdaten

- Kontoinhaber: Sicher-Schwimmen e.V.
- IBAN: DE85 3805 0186 5081 0160 13
- BIC/SWIFT: GENODED1BRS
- Bank: VR Bank Hennef

## Was gemacht wird

1. Zentrale Konfiguration (`src/lib/billing-config.ts`) mit den echten Daten füllen. Dadurch erscheint die Bankverbindung automatisch auch in den Kursbestätigungs-E-Mails, wo bisher „Bankverbindung wird separat mitgeteilt" stand.
2. Kursseite `/kurse`: eine gut sichtbare Box „Zahlung & Bankverbindung" mit Empfänger, IBAN, BIC, Bank sowie dem Hinweis auf Verwendungszweck (Kursname + Name des Kindes) und Zahlungsfrist (14 Tage nach Bestätigung, spätestens vor Kursbeginn).
3. Kursbedingungen: in Abschnitt „2. Kursgebühr & Zahlung" die Kontodaten konkret nennen statt nur auf „das in der Bestätigung genannte Konto" zu verweisen.

## Technisches

- Werte aus `BILLING` importieren, keine doppelte Pflege der IBAN in Komponenten.
- Bestehende Design-Tokens/Card-Komponenten verwenden, keine neuen Farben.
