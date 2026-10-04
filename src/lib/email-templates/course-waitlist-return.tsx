import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { BILLING, ORG } from "@/lib/billing-config";

interface Props {
  child_name?: string | null;
  old_course?: string | null;
  reason?: string | null;
  cancellation_fee?: string | null;
  amount_due?: string | null;
  credit?: string | null;
  due_date?: string | null;
  reference?: string | null;
}

const row = { margin: "3px 0" } as const;
const TERMS_URL = "https://sicher-schwimmen.com/kursbedingungen";

const WaitlistReturn = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>{`${p.child_name ?? "Ihr Kind"} steht wieder auf unserer Warteliste`}</Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" }}>
      <Container style={{ padding: "24px", maxWidth: "600px" }}>
        <Text style={{ ...row, fontWeight: "bold", fontSize: "16px" }}>{ORG.name}</Text>
        <Heading style={{ color: "#0c4a6e", fontSize: "20px", marginTop: "18px" }}>
          Kurs verschoben – zurück auf die Warteliste
        </Heading>
        <Text>Liebe Eltern,</Text>
        <Text>
          wie besprochen haben wir {p.child_name ?? "Ihr Kind"} aus dem Kurs{" "}
          <strong>„{p.old_course}“</strong> abgemeldet und auf unsere Warteliste gesetzt. Sobald in
          einem späteren Kurs ein Platz frei ist, erhalten Sie von uns ein Platzangebot per E-Mail.
        </Text>
        {p.reason ? <Text style={{ whiteSpace: "pre-wrap" }}>Grund: {p.reason}</Text> : null}
        <Hr />
        {p.cancellation_fee ? (
          <Text>
            Für die Abmeldung fällt gemäß{" "}
            <Link href={TERMS_URL}>§ 3 unserer Kursteilnahmebedingungen</Link> eine Stornogebühr von{" "}
            <strong>{p.cancellation_fee}</strong> an.
          </Text>
        ) : null}
        {p.amount_due ? (
          <>
            <Text>
              Bitte überweisen Sie <strong>{p.amount_due}</strong>
              {p.due_date ? (
                <>
                  {" "}
                  bis zum <strong>{p.due_date}</strong>
                </>
              ) : null}
              .
            </Text>
            <Text style={row}>Empfänger: {BILLING.recipient}</Text>
            <Text style={row}>IBAN: {BILLING.iban}</Text>
            {p.reference ? <Text style={row}>Verwendungszweck: {p.reference}</Text> : null}
          </>
        ) : p.credit ? (
          <Text>
            Von Ihrer bereits gezahlten Kursgebühr bleibt ein Guthaben von{" "}
            <strong>{p.credit}</strong>. Wir rechnen es auf den nächsten Kurs an. Wenn Sie lieber
            eine Erstattung möchten, antworten Sie einfach auf diese E-Mail.
          </Text>
        ) : (
          <Text>Es entstehen keine weiteren Kosten.</Text>
        )}
        <Hr />
        <Text style={{ fontSize: "13px", color: "#475569" }}>
          Fragen? Antworten Sie einfach auf diese E-Mail oder schreiben Sie an{" "}
          <Link href={`mailto:${ORG.email}`}>{ORG.email}</Link> bzw. rufen Sie uns an: {ORG.phone}.
        </Text>
        <Text style={{ marginTop: "16px" }}>Herzliche Grüße</Text>
        <Text style={row}>{ORG.signatory}</Text>
      </Container>
    </Body>
  </Html>
);

export const template: TemplateEntry = {
  component: WaitlistReturn,
  displayName: "Kurs verschoben – zurück auf die Warteliste (Eltern)",
  subject: (d) => `Kurs verschoben – ${d.child_name ?? "Ihr Kind"} steht wieder auf der Warteliste`,
  previewData: {
    child_name: "Mia",
    old_course: "Seepferdchen Kurhaus",
    reason: "Elternwunsch / Terminänderung",
    cancellation_fee: "40,00 €",
    credit: "40,00 €",
  },
};
