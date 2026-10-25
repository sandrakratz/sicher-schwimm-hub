import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  heading?: string;
  intro?: string;
  items?: string[];
  reason?: string | null;
  url?: string;
}

const Email = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>{p.heading ?? "Dienstplan"}</Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" }}>
      <Container style={{ padding: "24px", maxWidth: "600px" }}>
        <Heading style={{ color: "#0c4a6e", fontSize: "20px" }}>
          {p.heading ?? "Dienstplan"}
        </Heading>
        {p.intro && <Text>{p.intro}</Text>}
        <Section style={{ backgroundColor: "#f1f5f9", padding: "10px 16px", borderRadius: "8px" }}>
          {(p.items ?? []).map((it) => (
            <Text key={it} style={{ margin: "4px 0" }}>
              • {it}
            </Text>
          ))}
        </Section>
        {p.reason && <Text style={{ whiteSpace: "pre-wrap" }}>Grund: {p.reason}</Text>}
        {p.url && (
          <Button
            href={p.url}
            style={{
              backgroundColor: "#0c4a6e",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: "6px",
              fontWeight: "bold",
              marginTop: "8px",
            }}
          >
            Dienstplan öffnen
          </Button>
        )}
        <Hr />
        <Text style={{ fontSize: "13px", color: "#475569" }}>
          Automatische Nachricht aus dem Dienstplan. Im Verwaltungsbereich unter Kurse → Dienstplan
          steht, wer als Ersatz in Frage kommt.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template: TemplateEntry = {
  component: Email,
  displayName: "Intern – Dienstplan-Änderung (Absage/Übernahme)",
  to: "info@sicher-schwimmen.com",
  subject: (d: Record<string, any>) => String(d["subject"] ?? d["heading"] ?? "Dienstplan"),
  previewData: {
    heading: "Max Muster hat abgesagt",
    subject: "Absage: Max Muster · Sa 14.11.",
    intro: "Max Muster kann an folgenden Terminen nicht mehr. Dadurch fehlt jemand:",
    items: ["Bronze Hennef · Sa 14.11. · 09:00–09:45 Uhr (3. Termin) – nur noch 1 von 2"],
    reason: "krank",
    url: "https://sicher-schwimmen.com/admin/dienstplan",
  },
};
export default template;
