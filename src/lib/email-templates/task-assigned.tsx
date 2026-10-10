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
  assignee_name?: string;
  assigned_by?: string;
  what?: string;
  note?: string | null;
  url?: string;
}

const Email = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>
      {p.assigned_by ?? "Jemand"} hat Ihnen etwas zugewiesen: {p.what ?? ""}
    </Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" }}>
      <Container style={{ padding: "24px", maxWidth: "600px" }}>
        <Heading style={{ color: "#0c4a6e", fontSize: "20px" }}>Neue Zuständigkeit</Heading>
        <Text>{p.assignee_name ? `Hallo ${p.assignee_name},` : "Hallo,"}</Text>
        <Text>
          <strong>{p.assigned_by ?? "Ein Vorstandsmitglied"}</strong> hat Ihnen einen Vorgang
          zugewiesen:
        </Text>
        <Section style={{ backgroundColor: "#f1f5f9", padding: "14px 16px", borderRadius: "8px" }}>
          <Text style={{ margin: "3px 0" }}>
            <strong>{p.what ?? "Vorgang"}</strong>
          </Text>
          {p.note && (
            <Text style={{ margin: "8px 0 3px", whiteSpace: "pre-wrap" }}>Notiz: {p.note}</Text>
          )}
        </Section>
        {p.url && (
          <Button
            href={p.url}
            style={{
              backgroundColor: "#0c4a6e",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: "6px",
              fontWeight: "bold",
              marginTop: "16px",
            }}
          >
            Vorgang öffnen
          </Button>
        )}
        <Hr />
        <Text style={{ fontSize: "13px", color: "#475569" }}>
          Falls Sie sich nicht zuständig fühlen, können Sie den Vorgang im Verwaltungsbereich mit
          einer Notiz an jemand anderen weitergeben.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template: TemplateEntry = {
  component: Email,
  displayName: "Intern – Vorgang zugewiesen",
  subject: (d: Record<string, any>) => `Zugewiesen: ${d["what"] ?? "Vorgang"}`,
  previewData: {
    assignee_name: "Manuela",
    assigned_by: "Sandra Kratz",
    what: "Rückfrage „Warteliste behalten?“ – Freya Kaltenhäuser",
    note: "Bitte telefonisch klären, die Familie hat nicht geantwortet.",
    url: "https://sicher-schwimmen.com/admin/warteliste",
  },
};
export default template;
