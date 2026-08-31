# Zahlungserinnerung: neuer Text für überfällige Zahlungen

Die E-Mail-Vorlage „Zahlungserinnerung (Eltern)“ bekommt für **überfällige** Zahlungen den neuen, deutlicheren Text. Fälle mit erwarteter Sofortzahlung behalten den bisherigen Text.

## Neuer Ablauf im Text (überfällig)

1. Anrede „Liebe Eltern,“
2. Hinweis, dass für den Kursplatz von *[Kindername]* weder Zahlungseingang noch Rückmeldung vorliegt.
3. „Die Kursgebühr in Höhe von *[Betrag]* war bereits zum *[Fälligkeitsdatum]* fällig.“
4. Bitte um Überweisung **innerhalb von 3 Werktagen nach Erhalt dieser E-Mail**.
5. Kursblock: Kurs, Kurszeitraum, Kursort, Offener Betrag.
6. Bankblock: Kontoinhaber, IBAN, BIC, Verwendungszweck (unverändertes Format: Kursname + Name des Kindes + Kursbeginn) – inklusive bestehendem GiroCode-QR-Code.
7. Hinweis: Ohne Zahlung oder Rückmeldung innerhalb der Frist wird der Kursplatz **ohne weitere Ankündigung freigegeben**.
8. Absatz zur hohen Nachfrage und dazu, dass künftig keine weiteren Kursbuchungen ermöglicht werden können.
9. Hinweis „bereits bezahlt = gegenstandslos, kurze Rückmeldung erwünscht“.
10. Kontaktzeile mit E-Mail (klickbarer mailto-Link) und Telefonnummer.
11. Grußformel: „Herzliche Grüße“, Michael Kratz, 1. Vorsitzender, Sicher-Schwimmen e. V.

Alle Namen, Beträge, Daten, Kursangaben und Kontaktdaten kommen weiterhin aus dem Datensatz bzw. der zentralen Konfiguration – keine festen Beispielwerte.

## Sofortzahlungs-Variante

Bleibt inhaltlich wie bisher (Hinweis auf Echtzeit-/Sofortüberweisung), ebenfalls mit QR-Code.

## Technische Umsetzung

- Nur `src/lib/email-templates/payment-reminder.tsx` wird angepasst: zwei Textvarianten je nach `reminder_kind` / abgeleitetem Zahlungsstatus.
- Werte weiterhin über `buildConfirmationDoc` (Betrag, Fälligkeitsdatum, Kursdaten, Verwendungszweck, QR-URL) und `ORG` aus `src/lib/billing-config.ts`.
- Versandlogik (`src/lib/payment-reminders.functions.ts`) und Admin-Button bleiben unverändert.
- Vorschau der Vorlage im Verwaltungsbereich zeigt danach den neuen Text.
