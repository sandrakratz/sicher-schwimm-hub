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
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { ORG } from "@/lib/billing-config";

interface Props {
  parent_name?: string | null;
  child_name?: string | null;
  reason?: "declined" | "expired";
  count?: number;
  max?: number;
  expires_label?: string;
  answer_url?: string;
  alternatives?: Array<{ name: string; starts_label: string }>;
}

const row = { margin: "3px 0" } as const;

const Email = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>Soll {p.child_name ?? "Ihr Kind"} auf der Warteliste bleiben?</Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" }}>
      <Container style={{ padding: "24px", maxWidth: "600px" }}>
        <Text style={{ ...row, fontWeight: "bold", fontSize: "16px" }}>{ORG.name}</Text>
        <Heading style={{ color: "#0c4a6e", fontSize: "20px", marginTop: "18px" }}>
          Weiter auf der Warteliste bleiben?
        </Heading>
        <Text>{p.parent_name ? `Liebe Familie ${p.parent_name},` : "Liebe Eltern,"}</Text>
        <Text>
          {p.reason === "expired"
            ? `leider haben wir auf unser Platzangebot für ${p.child_name ?? "Ihr Kind"} innerhalb der Frist keine Rückmeldung erhalten. Der Platz wurde daher an die nächste Familie vergeben.`
            : `vielen Dank für Ihre Rückmeldung zum Platzangebot für ${p.child_name ?? "Ihr Kind"}. Der Platz wurde an die nächste Familie vergeben.`}
        </Text>
        <Text>
          Bitte teilen Sie uns <strong>bis {p.expires_label ?? "zum angegebenen Datum"}</strong>{" "}
          mit, ob Ihr Kind weiterhin auf der Warteliste bleiben soll – und ab wann wir es bei der
          Platzvergabe wieder berücksichtigen dürfen.
        </Text>
        {p.alternatives && p.alternatives.length > 0 && (
          <>
            <Text>
              Falls Sie nicht warten möchten: Aktuell haben wir freie Plätze in folgenden Kursen.
              Melden Sie sich gern bei uns, wenn einer davon für Sie passt.
            </Text>
            {p.alternatives.map((a) => (
              <Text key={a.name + a.starts_label} style={row}>
                • {a.name} (Start {a.starts_label})
              </Text>
            ))}
          </>
        )}
        {p.answer_url && (
          <Button
            href={p.answer_url}
            style={{
              backgroundColor: "#0c4a6e",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: "6px",
              fontWeight: "bold",
            }}
          >
            Jetzt antworten
          </Button>
        )}
        <Hr />
        <Text style={{ fontSize: "13px", color: "#475569" }}>
          Ohne Antwort bis zum genannten Datum wird der Wartelistenplatz gestrichen. Hinweis: Nach{" "}
          {p.max ?? 3} abgesagten oder unbeantworteten Platzangeboten wird der Wartelistenplatz
          automatisch deaktiviert (bisher: {p.count ?? 1}).
        </Text>
        <Text style={{ fontSize: "13px", color: "#475569" }}>
          Fragen? <Link href={`mailto:${ORG.email}`}>{ORG.email}</Link>
        </Text>
        <Text style={{ marginTop: "16px" }}>Herzliche Grüße</Text>
        <Text style={row}>{ORG.signatory}</Text>
      </Container>
    </Body>
  </Html>
);

export const template: TemplateEntry = {
  component: Email,
  displayName: "Warteliste – Rückfrage nach Absage",
  subject: "Soll Ihr Kind auf der Warteliste bleiben?",
  previewData: {
    parent_name: "Muster",
    child_name: "Mia Muster",
    reason: "declined",
    count: 1,
    max: 3,
    expires_label: "07.10.2026",
    answer_url: "https://sicher-schwimmen.com/warteliste/rueckfrage?token=x",
    alternatives: [{ name: "Schwimmstarter", starts_label: "02.11.2026" }],
  },
};
export default template;
