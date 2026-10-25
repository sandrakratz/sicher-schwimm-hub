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
  name?: string;
  heading?: string;
  intro?: string;
  sections?: { title: string; items: string[] }[];
  note?: string | null;
  url?: string;
  button?: string;
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
        <Text>{p.name ? `Hallo ${p.name},` : "Hallo,"}</Text>
        {p.intro && <Text>{p.intro}</Text>}
        {(p.sections ?? []).map((s) => (
          <Section
            key={s.title}
            style={{
              backgroundColor: "#f1f5f9",
              padding: "10px 16px",
              borderRadius: "8px",
              marginBottom: "12px",
            }}
          >
            <Text style={{ margin: "4px 0", fontWeight: "bold" }}>{s.title}</Text>
            {s.items.map((it) => (
              <Text key={it} style={{ margin: "3px 0" }}>
                • {it}
              </Text>
            ))}
          </Section>
        ))}
        {p.note && <Text style={{ whiteSpace: "pre-wrap" }}>Hinweis: {p.note}</Text>}
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
            {p.button ?? "Zum Trainerbereich"}
          </Button>
        )}
        <Hr />
        <Text style={{ fontSize: "13px", color: "#475569" }}>
          Wenn du an einem Termin doch nicht kannst, melde dich bitte im Trainerbereich unter „Meine
          Verfügbarkeit“ → „Meine Einsätze“ ab oder ruf kurz beim Vorstand an.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template: TemplateEntry = {
  component: Email,
  displayName: "Dienstplan – Mitteilung an Trainer:in",
  subject: (d: Record<string, any>) => String(d["subject"] ?? d["heading"] ?? "Dienstplan"),
  previewData: {
    name: "Max",
    heading: "Kannst du einspringen?",
    subject: "Ersatz gesucht: Sa 14.11.",
    intro:
      "Bei diesem Termin fehlt noch jemand. Wer zuerst „Ich übernehme“ klickt, ist eingeteilt.",
    sections: [
      {
        title: "Ersatz gesucht",
        items: ["Bronze Hennef · Sa 14.11. · 09:00–09:45 Uhr (3. Termin)"],
      },
    ],
    url: "https://sicher-schwimmen.com/trainer/verfuegbarkeit",
    button: "Termin ansehen und übernehmen",
  },
};
export default template;
