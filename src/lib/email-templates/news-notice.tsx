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
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  title?: string;
  preview?: string;
  url?: string;
  /** true = Beitrag nur für eingeloggte Mitglieder */
  membersOnly?: boolean;
}

const Email = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>{p.title ?? "Neuigkeiten von Sicher Schwimmen e. V."}</Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" }}>
      <Container style={{ padding: "24px", maxWidth: "600px" }}>
        <Text style={{ margin: "0 0 4px", fontSize: "13px", color: "#475569" }}>
          Neu auf unserer Webseite
        </Text>
        <Heading style={{ color: "#0c4a6e", fontSize: "22px", marginTop: "0" }}>
          {p.title ?? "Neuigkeiten"}
        </Heading>
        {p.preview && (
          <Text style={{ whiteSpace: "pre-wrap", lineHeight: "1.5" }}>{p.preview}</Text>
        )}
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
            Weiterlesen
          </Button>
        )}
        {p.membersOnly && (
          <Text style={{ fontSize: "13px", color: "#475569" }}>
            Dieser Beitrag ist im Mitgliederbereich nach der Anmeldung sichtbar.
          </Text>
        )}
        <Hr />
        <Text style={{ fontSize: "13px", color: "#475569" }}>
          Sie erhalten diese Vereinsinformation als Mitglied von Sicher Schwimmen e. V. Wenn Sie
          keine Neuigkeiten per E-Mail möchten, antworten Sie bitte kurz auf diese Mail, dann nehmen
          wir Sie aus dem Verteiler.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template: TemplateEntry = {
  component: Email,
  displayName: "News-Hinweis an Mitglieder",
  subject: (d: Record<string, any>) => `Neuigkeiten: ${String(d["title"] ?? "Sicher Schwimmen")}`,
  previewData: {
    title: "Familienschwimmen startet am 21.11.",
    preview:
      "Ab sofort könnt ihr euch im Mitgliederbereich für das Familienschwimmen in der Sportschule Hennef anmelden …",
    url: "https://sicher-schwimmen.com/news",
  },
};
export default template;
