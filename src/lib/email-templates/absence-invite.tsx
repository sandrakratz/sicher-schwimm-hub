import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { ORG } from "@/lib/billing-config";

interface Child {
  name?: string | null;
  course?: string | null;
  url: string;
}

interface Props {
  children_links?: Child[];
}

const Email = (p: Props) => {
  const list = p.children_links ?? [];
  return (
    <Html lang="de">
      <Head />
      <Preview>Kind einfach per Link vom Schwimmkurs abmelden – ohne Konto</Preview>
      <Body
        style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" }}
      >
        <Container style={{ padding: "24px", maxWidth: "600px" }}>
          <Text style={{ margin: "3px 0", fontWeight: "bold", fontSize: "16px" }}>{ORG.name}</Text>
          <Heading style={{ color: "#0c4a6e", fontSize: "20px", marginTop: "18px" }}>
            Neu: Kind für einzelne Termine abmelden
          </Heading>
          <Text>Liebe Eltern,</Text>
          <Text>
            wenn Ihr Kind an einem Kurstermin nicht teilnehmen kann, zum Beispiel wegen Krankheit,
            können Sie es ab sofort selbst mit einem Tipp abmelden. Die Trainer sehen die Abmeldung
            sofort in ihrer Teilnehmerliste. Sie brauchen dafür kein Konto und müssen keinen Grund
            angeben. Auch spätere Termine können Sie im Voraus abmelden.
          </Text>
          <Section
            style={{
              padding: "12px 16px",
              backgroundColor: "#f0f9ff",
              borderRadius: "8px",
              border: "1px solid #bae6fd",
            }}
          >
            {list.map((c, i) => (
              <Text key={`${c.url}-${i}`} style={{ margin: "6px 0" }}>
                <Link href={c.url} style={{ color: "#0c4a6e", fontWeight: "bold" }}>
                  {c.name ? `${c.name} abmelden` : "Kind abmelden"}
                </Link>
                {c.course ? <span style={{ color: "#475569" }}> · {c.course}</span> : null}
              </Text>
            ))}
          </Section>
          <Text style={{ fontSize: "13px", color: "#475569" }}>
            Die Links gehören nur zu Ihrer Buchung – bitte nicht weitergeben. Eine Abmeldung ändert
            nichts an der Kursgebühr. Bitte heben Sie diese Mail auf, dann haben Sie den Link immer
            zur Hand.
          </Text>
          <Text style={{ marginTop: "16px" }}>Herzliche Grüße</Text>
          <Text style={{ margin: "3px 0" }}>{ORG.signatory}</Text>
          <Text style={{ margin: "3px 0", fontSize: "12px", color: "#475569" }}>{ORG.name}</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  displayName: "Info: Kind per Link abmelden (Eltern)",
  subject: "Neu: Ihr Kind einfach per Link vom Schwimmkurs abmelden",
  previewData: {
    children_links: [
      {
        name: "Mia",
        course: "Seepferdchen Kurhaus",
        url: "https://sicher-schwimmen.com/abmelden?token=abc",
      },
    ],
  },
} satisfies TemplateEntry;
