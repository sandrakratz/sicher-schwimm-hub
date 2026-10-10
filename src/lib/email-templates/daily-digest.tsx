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

interface Line {
  label: string;
  count: number;
  detail?: string;
  url: string;
}

interface Props {
  first_name?: string;
  lines?: Line[];
  settings_url?: string;
}

const Email = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>Das liegt heute bei Ihnen – Sicher Schwimmen e.V.</Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" }}>
      <Container style={{ padding: "24px", maxWidth: "600px" }}>
        <Heading style={{ color: "#0c4a6e", fontSize: "20px" }}>Das liegt heute bei Ihnen</Heading>
        <Text>{p.first_name ? `Guten Morgen ${p.first_name},` : "Guten Morgen,"}</Text>
        <Text>das sind die offenen Vorgänge, für die Sie zuständig sind:</Text>
        <Section style={{ backgroundColor: "#f1f5f9", padding: "10px 16px", borderRadius: "8px" }}>
          {(p.lines ?? []).map((l) => (
            <Text key={l.label} style={{ margin: "8px 0" }}>
              <strong style={{ fontSize: "18px" }}>{l.count}</strong> {l.label}
              {l.detail ? ` (${l.detail})` : ""}
              <br />
              <a href={l.url} style={{ color: "#0c4a6e", fontSize: "13px" }}>
                Liste öffnen
              </a>
            </Text>
          ))}
        </Section>
        <Button
          href="https://sicher-schwimmen.com/admin"
          style={{
            backgroundColor: "#0c4a6e",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "6px",
            fontWeight: "bold",
            marginTop: "16px",
          }}
        >
          Zur Startseite „Heute“
        </Button>
        <Hr />
        <Text style={{ fontSize: "12px", color: "#475569" }}>
          Diese Zusammenfassung kommt werktags früh und nur, wenn etwas offen ist. Abbestellen unter
          Verwaltung → Mitglieder → Zuständigkeiten.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template: TemplateEntry = {
  component: Email,
  displayName: "Intern – tägliche Zusammenfassung",
  subject: (d: Record<string, any>) => {
    const n = ((d["lines"] as Line[] | undefined) ?? []).reduce((s, l) => s + l.count, 0);
    return `Heute bei Ihnen: ${n} offene Vorgänge`;
  },
  previewData: {
    first_name: "Manuela",
    lines: [
      {
        label: "Offene Zahlungen",
        count: 12,
        detail: "davon 3 überfällig",
        url: "https://sicher-schwimmen.com/admin/zahlungen?zustaendig=ich",
      },
    ],
  },
};
export default template;
