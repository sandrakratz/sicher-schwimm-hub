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
  first_name?: string;
  membership_label?: string;
  login_url?: string;
}

const Email = ({ first_name, membership_label, login_url }: Props) => (
  <Html lang="de">
    <Head />
    <Preview>Dein Konto bei Sicher Schwimmen e.V. ist jetzt freigeschaltet</Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" }}>
      <Container style={{ padding: "24px", maxWidth: "600px" }}>
        <Heading style={{ color: "#0c4a6e" }}>Herzlich willkommen!</Heading>
        <Text>{first_name ? `Hallo ${first_name},` : "Hallo,"}</Text>
        <Text>
          der Vorstand hat dein Konto geprüft und freigeschaltet
          {membership_label ? ` (Mitgliedschaft: ${membership_label})` : ""}. Ab sofort kannst du
          dich im Mitgliederbereich anmelden.
        </Text>
        <Text>Dort findest du Kurse, Termine, Neuigkeiten und Vereinsdokumente.</Text>
        <Button
          href={login_url || "https://sicher-schwimmen.com/auth"}
          style={{
            backgroundColor: "#0c4a6e",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "8px",
            textDecoration: "none",
          }}
        >
          Jetzt anmelden
        </Button>
        <Hr />
        <Text style={{ fontSize: "13px", color: "#475569" }}>
          Fragen? Antworte einfach an info@sicher-schwimmen.com.
          <br />
          Viele Grüße, dein Team von Sicher Schwimmen e.V.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Dein Konto wurde freigeschaltet – Herzlich willkommen bei Sicher Schwimmen e.V.!",
  displayName: "Konto freigeschaltet",
  previewData: {
    first_name: "Sandy",
    membership_label: "Familie",
    login_url: "https://sicher-schwimmen.com/auth",
  },
} satisfies TemplateEntry;
