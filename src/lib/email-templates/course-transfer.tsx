import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { BILLING, ORG } from "@/lib/billing-config";

interface Props {
  child_name?: string | null;
  old_course?: string | null;
  new_course?: string | null;
  new_schedule?: string | null;
  new_location?: string | null;
  new_start?: string | null;
  sessions?: string[] | null;
  reason?: string | null;
  amount_due?: string | null;
  refund?: string | null;
  due_date?: string | null;
  reference?: string | null;
  consent_url?: string | null;
}

const row = { margin: "3px 0" } as const;

const Transfer = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>{`Bitte bestätigen Sie die Umbuchung in den Kurs ${p.new_course ?? ""}`}</Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" }}>
      <Container style={{ padding: "24px", maxWidth: "600px" }}>
        <Text style={{ ...row, fontWeight: "bold", fontSize: "16px" }}>{ORG.name}</Text>
        <Heading style={{ color: "#0c4a6e", fontSize: "20px", marginTop: "18px" }}>
          Kursumbuchung – bitte um Ihre Zustimmung
        </Heading>
        <Text>Liebe Eltern,</Text>
        <Text>
          wir möchten {p.child_name ?? "Ihr Kind"} vom Kurs <strong>„{p.old_course}“</strong> in den
          Kurs <strong>„{p.new_course}“</strong> umbuchen.
        </Text>
        {p.reason ? <Text style={{ whiteSpace: "pre-wrap" }}>Grund: {p.reason}</Text> : null}
        <Text style={row}>{p.new_schedule ? `Zeit: ${p.new_schedule}` : null}</Text>
        <Text style={row}>{p.new_location ? `Ort: ${p.new_location}` : null}</Text>
        {p.sessions && p.sessions.length > 0 ? (
          <>
            <Text style={{ ...row, marginTop: "12px", fontWeight: "bold" }}>
              Ihre nächsten Termine:
            </Text>
            {p.sessions.map((s, i) => (
              <Text key={i} style={row}>
                {s}
              </Text>
            ))}
          </>
        ) : null}
        <Hr />
        {p.amount_due ? (
          <>
            <Text>
              Die bereits bezahlten, noch nicht genutzten Stunden haben wir angerechnet. Es bleibt
              ein Restbetrag von <strong>{p.amount_due}</strong>
              {p.due_date ? (
                <>
                  {" "}
                  – bitte bis <strong>{p.due_date}</strong> überweisen
                </>
              ) : null}
              .
            </Text>
            <Text style={row}>Empfänger: {BILLING.recipient}</Text>
            <Text style={row}>IBAN: {BILLING.iban}</Text>
            {p.reference ? <Text style={row}>Verwendungszweck: {p.reference}</Text> : null}
          </>
        ) : p.refund ? (
          <Text>
            Aus dem bisherigen Kurs bleibt ein Guthaben von <strong>{p.refund}</strong>. Wir melden
            uns wegen der Erstattung bzw. Verrechnung.
          </Text>
        ) : (
          <Text>
            Die Kursgebühr ist vollständig beglichen – es entstehen keine weiteren Kosten.
          </Text>
        )}
        <Hr />
        {p.consent_url ? (
          <Section
            style={{
              backgroundColor: "#f0f9ff",
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid #bae6fd",
              textAlign: "center" as const,
            }}
          >
            <Text style={{ margin: "0 0 12px", fontWeight: "bold" }}>
              Bitte stimmen Sie der Umbuchung
              {p.amount_due || p.refund ? " und der Gebührenverrechnung" : ""} zu.
            </Text>
            <Button
              href={p.consent_url}
              style={{
                backgroundColor: "#0c4a6e",
                color: "#ffffff",
                padding: "12px 22px",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: "bold",
              }}
            >
              Umbuchung ansehen und zustimmen
            </Button>
            <Text style={{ margin: "12px 0 0", fontSize: "12px", color: "#475569" }}>
              Auf der folgenden Seite sehen Sie alle Angaben noch einmal und bestätigen mit einem
              Klick. Ihre Zustimmung wird bei uns mit Datum und Uhrzeit gespeichert.
            </Text>
            <Text style={{ margin: "8px 0 0", fontSize: "12px", color: "#475569" }}>
              Falls der Button nicht funktioniert: <Link href={p.consent_url}>{p.consent_url}</Link>
            </Text>
          </Section>
        ) : null}
        <Text style={{ marginTop: "14px", fontSize: "13px", color: "#475569" }}>
          Sind Sie mit der Umbuchung nicht einverstanden oder haben Fragen? Antworten Sie einfach
          auf diese E-Mail oder schreiben Sie an{" "}
          <Link href={`mailto:${ORG.email}`}>{ORG.email}</Link> bzw. rufen Sie uns an: {ORG.phone}.
        </Text>
        <Text style={{ marginTop: "16px" }}>Herzliche Grüße</Text>
        <Text style={row}>{ORG.signatory}</Text>
      </Container>
    </Body>
  </Html>
);

export const template: TemplateEntry = {
  component: Transfer,
  displayName: "Kurswechsel / Umbuchung (mit Zustimmung der Eltern)",
  subject: (d) =>
    `Bitte um Zustimmung – Kursumbuchung: ${d.child_name ?? ""} – ${d.new_course ?? "neuer Kurs"}`,
  previewData: {
    child_name: "Mia",
    old_course: "Seepferdchen Kurhaus",
    new_course: "Aufbaukurs Sportschule",
    new_schedule: "Sa 12:00–12:45",
    reason: "Trainer-Empfehlung",
    amount_due: "70,00 €",
    due_date: "10.11.2026",
    consent_url:
      "https://sicher-schwimmen.com/umbuchung?token=0123456789abcdef0123456789abcdef0123456789abcdef",
  },
};
