import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { ORG } from "@/lib/billing-config";
import { PushHint } from "./push-hint";

interface Props {
  child_name?: string | null;
  course_name?: string | null;
  push_url?: string;
}

const Email = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>Notfall-Mitteilungen zu Ihrem Schwimmkurs aufs Handy aktivieren</Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" }}>
      <Container style={{ padding: "24px", maxWidth: "600px" }}>
        <Text style={{ margin: "3px 0", fontWeight: "bold", fontSize: "16px" }}>{ORG.name}</Text>
        <Heading style={{ fontSize: "20px", marginTop: "18px" }}>
          Kurzfristige Kursinfos direkt aufs Handy
        </Heading>
        <Text>Liebe Eltern,</Text>
        <Text>
          damit Sie bei kurzfristigen Ausfällen im Kurs {p.course_name ? `„${p.course_name}“` : ""}
          {p.child_name ? ` (${p.child_name})` : ""} sofort Bescheid wissen, können Sie ab sofort
          Mitteilungen direkt auf Ihr Smartphone erhalten. Die E-Mail bekommen Sie wie gewohnt
          zusätzlich.
        </Text>
        <PushHint url={p.push_url ?? "https://sicher-schwimmen.com"} />
        <Text style={{ marginTop: "16px" }}>Herzliche Grüße</Text>
        <Text style={{ margin: "3px 0" }}>{ORG.signatory}</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  displayName: "Einladung Handy-Mitteilungen",
  subject: "Wichtig für Ihren Schwimmkurs: Notfall-Mitteilungen aufs Handy aktivieren",
  previewData: {
    child_name: "Mia",
    course_name: "Seepferdchen",
    push_url: "https://sicher-schwimmen.com/mitteilungen?token=abc",
  },
} satisfies TemplateEntry;
