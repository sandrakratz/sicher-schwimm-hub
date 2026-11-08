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
  /** Wichtige Hinweise zur Teilnahme (nur bei Zusagen) */
  safety?: boolean;
  url?: string;
  button?: string;
}

const SAFETY = [
  "Wasserzeit: 12:00–12:45 Uhr in der Sportschule Hennef. Das Bad muss spätestens um 13:00 Uhr verlassen sein.",
  "Jedes Kind wird von einer erwachsenen Begleitperson begleitet. Sie übernimmt die Verantwortung für das eigene Kind.",
  "Kinder, die ohne erwachsene Begleitung im Wasser sind, brauchen mindestens das Bronzeabzeichen und eine volljährige Aufsichtsperson auf der Tribüne. Bitte den Schwimmausweis des Kindes zum Termin mitbringen.",
  "Bitte komm pünktlich. Wenn du nicht kannst, sag bitte rechtzeitig im Mitgliederbereich ab, damit eine andere Familie nachrücken kann.",
];

const Email = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>{p.heading ?? "Familienschwimmen"}</Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" }}>
      <Container style={{ padding: "24px", maxWidth: "600px" }}>
        <Heading style={{ color: "#0c4a6e", fontSize: "20px" }}>
          {p.heading ?? "Familienschwimmen"}
        </Heading>
        <Text>{p.name ? `Hallo ${p.name},` : "Hallo,"}</Text>
        {p.intro && <Text style={{ whiteSpace: "pre-wrap" }}>{p.intro}</Text>}
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
        {p.safety && (
          <Section
            style={{
              backgroundColor: "#ecfeff",
              padding: "10px 16px",
              borderRadius: "8px",
              marginBottom: "12px",
            }}
          >
            <Text style={{ margin: "4px 0", fontWeight: "bold" }}>Wichtig für den Tag</Text>
            {SAFETY.map((it) => (
              <Text key={it} style={{ margin: "3px 0" }}>
                • {it}
              </Text>
            ))}
          </Section>
        )}
        {p.note && <Text style={{ whiteSpace: "pre-wrap" }}>{p.note}</Text>}
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
            {p.button ?? "Zum Mitgliederbereich"}
          </Button>
        )}
        <Hr />
        <Text style={{ fontSize: "13px", color: "#475569" }}>
          Sicher Schwimmen e. V. · Das Familienschwimmen ist ein Angebot für Vereinsmitglieder. Eine
          Anmeldung ist zunächst nur eine Platzanfrage, verbindlich ist erst die Zusage des Vereins.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template: TemplateEntry = {
  component: Email,
  displayName: "Familienschwimmen – Mitteilung an Mitglieder",
  subject: (d: Record<string, any>) => String(d["subject"] ?? d["heading"] ?? "Familienschwimmen"),
  previewData: {
    name: "Anna",
    heading: "Deine Zusage für das Familienschwimmen",
    subject: "Zusage Familienschwimmen: Sa 21.11.2026",
    intro: "Wir haben für euch einen Platz. Die Teilnahme ist damit verbindlich zugesagt.",
    sections: [
      {
        title: "Zugesagt",
        items: ["Sa., 21.11.2026 · 12:00–12:45 Uhr · Sportschule Hennef · 3 Personen"],
      },
    ],
    safety: true,
    url: "https://sicher-schwimmen.com/portal/familienschwimmen",
    button: "Meine Anmeldungen ansehen",
  },
};
export default template;
