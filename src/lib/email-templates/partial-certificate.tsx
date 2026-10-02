import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  parent_name?: string | null;
  child_name?: string;
  level_label?: string;
  deadline?: string;
  download_url?: string;
}

const Email = ({ parent_name, child_name, level_label, deadline, download_url }: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Teilleistungsnachweis für {child_name ?? "Ihr Kind"}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Toll gemacht, {child_name ?? "liebes Kind"}!</Heading>
        <Text style={text}>{parent_name ? `Hallo ${parent_name},` : "Liebe Eltern,"}</Text>
        <Text style={text}>
          der Schwimmkurs ist zu Ende. {child_name ?? "Ihr Kind"} hat bereits einen Teil der Prüfung
          für das Abzeichen „{level_label ?? "Schwimmabzeichen"}“ geschafft – darauf kann es stolz
          sein!
        </Text>
        <Text style={text}>
          Im Teilleistungsnachweis stehen alle bestandenen und noch offenen Prüfungsteile. Mit
          diesem Nachweis können die fehlenden Teile in jedem Schwimmbad bei einer prüfberechtigten
          Person nachgeholt werden. Danach wird dort das Abzeichen ausgestellt.
        </Text>
        <Text style={strong}>
          Bitte beachten: Die offenen Teile müssen bis spätestens {deadline ?? "–"} abgelegt werden.
        </Text>
        {download_url && (
          <Button href={download_url} style={button}>
            Teilleistungsnachweis herunterladen (PDF)
          </Button>
        )}
        <Text style={small}>
          Bitte speichern oder drucken Sie den Nachweis – der Link ist bis zum Ende der Frist
          gültig.
        </Text>
        <Text style={text}>
          Viele Grüße
          <br />
          Ihr Team von Sicher Schwimmen e.V.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Teilleistungsnachweis für ${d["child_name"] ?? "Ihr Kind"}`,
  displayName: "Teilleistungsnachweis an Eltern",
  previewData: {
    parent_name: "Frau Muster",
    child_name: "Lena",
    level_label: "Deutsches Schwimmabzeichen Bronze (Freischwimmer)",
    deadline: "30.11.2026",
    download_url: "https://sicher-schwimmen.com",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "24px 28px", maxWidth: "560px" };
const h1 = { fontSize: "22px", color: "#0b3a5b", margin: "0 0 16px" };
const text = { fontSize: "15px", lineHeight: "22px", color: "#1f2937" };
const strong = { ...text, fontWeight: 700 };
const small = { fontSize: "12px", color: "#6b7280" };
const button = {
  backgroundColor: "#0b6fa4",
  color: "#ffffff",
  padding: "12px 18px",
  borderRadius: "8px",
  fontSize: "15px",
  textDecoration: "none",
};
