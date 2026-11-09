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
  firstName?: string;
  url?: string;
}

// Bewusst ohne Betreff und Text der Nachricht: Der Inhalt steht nur im geschützten Mitgliederbereich.
const Email = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>Im Mitgliederbereich wartet eine Nachricht auf Sie.</Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" }}>
      <Container style={{ padding: "24px", maxWidth: "600px" }}>
        <Heading style={{ color: "#0c4a6e", fontSize: "22px", marginTop: "0" }}>
          Neue Nachricht vom Vorstand
        </Heading>
        <Text style={{ lineHeight: "1.5" }}>
          {p.firstName ? `Hallo ${p.firstName},` : "Hallo,"}
          <br />
          der Vorstand von Sicher Schwimmen e. V. hat Ihnen eine Nachricht geschickt. Sie finden sie
          nach der Anmeldung in Ihrem Mitgliederkonto unter „Postfach“.
        </Text>
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
            Nachricht lesen
          </Button>
        )}
        <Hr />
        <Text style={{ fontSize: "13px", color: "#475569" }}>
          Aus Datenschutzgründen steht der Inhalt nicht in dieser Mail. Bitte antworten Sie nicht
          auf diese Mail, sondern nutzen Sie im Mitgliederbereich „Verein kontaktieren“.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template: TemplateEntry = {
  component: Email,
  displayName: "Nachricht vom Vorstand – Hinweis an Mitglied",
  subject: "Neue Nachricht von Sicher Schwimmen e. V. in Ihrem Mitgliederkonto",
  previewData: {
    firstName: "Anna",
    url: "https://sicher-schwimmen.com/portal/postfach",
  },
};
export default template;
