import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { ORG } from "@/lib/billing-config";

interface Props {
  /** Vorname des Geburtstagskindes */
  first_name?: string;
  /** true = Kind: Mail geht an die Eltern */
  child?: boolean;
  /** Alter, das das Kind wird (nur bei Kindern genannt) */
  age?: number | null;
  /** Anrede der Eltern, z. B. „Familie Muster“ */
  family?: string | null;
}

const Email = (p: Props) => {
  const name = p.first_name || "";
  return (
    <Html lang="de">
      <Head />
      <Preview>Herzlichen Glückwunsch zum Geburtstag!</Preview>
      <Body
        style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" }}
      >
        <Container style={{ padding: "24px", maxWidth: "600px" }}>
          <Text style={{ margin: "3px 0", fontWeight: "bold", fontSize: "16px" }}>{ORG.name}</Text>
          <Heading style={{ color: "#0c4a6e", fontSize: "22px", marginTop: "18px" }}>
            🎉 Herzlichen Glückwunsch, {name}!
          </Heading>
          {p.child ? (
            <>
              <Text>Liebe {p.family || "Eltern"},</Text>
              <Text>
                zum {p.age ? `${p.age}. ` : ""}Geburtstag von {name} gratulieren wir ganz herzlich!
                Wir wünschen {name} alles Liebe, viel Freude im Wasser und weiterhin viel Spaß bei
                uns im Verein.
              </Text>
            </>
          ) : (
            <>
              <Text>Hallo {name},</Text>
              <Text>
                zu Ihrem Geburtstag gratulieren wir Ihnen ganz herzlich! Wir wünschen Ihnen alles
                Gute, Gesundheit und viele schöne Stunden im Wasser. Schön, dass Sie Mitglied bei
                uns sind.
              </Text>
            </>
          )}
          <Text style={{ marginTop: "16px" }}>Herzliche Grüße</Text>
          <Text style={{ margin: "3px 0" }}>Der Vorstand</Text>
          <Text style={{ margin: "3px 0", fontSize: "12px", color: "#475569" }}>{ORG.name}</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  displayName: "Geburtstagsglückwunsch (Mitglied bzw. Eltern)",
  subject: (d: Record<string, unknown>) =>
    `Alles Gute zum Geburtstag${d["first_name"] ? `, ${String(d["first_name"])}` : ""}!`,
  previewData: { first_name: "Lena", child: true, age: 7, family: "Familie Muster" },
} satisfies TemplateEntry;
