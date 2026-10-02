import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { ORG } from "@/lib/billing-config";

interface Props {
  parent_name?: string | null;
  child_name?: string | null;
  course_name?: string | null;
  old_start?: string | null;
  new_start?: string | null;
  new_end?: string | null;
  reason?: string | null;
  paid?: boolean | null;
}

const row = { margin: "3px 0" } as const;
const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" };

function Frame({
  preview,
  title,
  children,
}: {
  preview: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Html lang="de">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={{ padding: "24px", maxWidth: "600px" }}>
          <Text style={{ ...row, fontWeight: "bold", fontSize: "16px" }}>{ORG.name}</Text>
          <Heading style={{ color: "#0c4a6e", fontSize: "20px", marginTop: "18px" }}>
            {title}
          </Heading>
          {children}
          <Hr />
          <Text style={{ fontSize: "13px", color: "#475569" }}>
            Fragen? <Link href={`mailto:${ORG.email}`}>{ORG.email}</Link> oder {ORG.phone}
          </Text>
          <Text style={{ marginTop: "16px" }}>Herzliche Grüße</Text>
          <Text style={row}>{ORG.signatory}</Text>
          <Text style={{ ...row, fontSize: "12px", color: "#475569" }}>{ORG.name}</Text>
        </Container>
      </Body>
    </Html>
  );
}

const Reschedule = (p: Props) => (
  <Frame preview={`Neuer Kursbeginn: ${p.new_start ?? ""}`} title="Update zum Kursstart">
    <Text>{p.parent_name ? `Liebe Familie ${p.parent_name},` : "Liebe Eltern,"}</Text>
    <Text>
      der Kurs <strong>„{p.course_name ?? "Schwimmkurs"}“</strong>
      {p.child_name ? (
        <>
          {" "}
          von <strong>{p.child_name}</strong>
        </>
      ) : null}{" "}
      beginnt nicht wie geplant
      {p.old_start ? ` am ${p.old_start}` : ""}, sondern am <strong>{p.new_start}</strong>
      {p.new_end ? ` (letzter Termin ${p.new_end})` : ""}.
    </Text>
    {p.reason ? <Text style={{ whiteSpace: "pre-wrap" }}>{p.reason}</Text> : null}
    <Text>
      Alle Kurstage verschieben sich entsprechend, der Kursumfang bleibt vollständig erhalten. Die
      Buchung bleibt bestehen – Sie müssen nichts weiter tun.
    </Text>
  </Frame>
);

const Cancel = (p: Props) => (
  <Frame preview="Der Kurs muss leider abgesagt werden" title="Kursabsage">
    <Text>{p.parent_name ? `Liebe Familie ${p.parent_name},` : "Liebe Eltern,"}</Text>
    <Text>
      leider müssen wir den Kurs <strong>„{p.course_name ?? "Schwimmkurs"}“</strong>
      {p.old_start ? ` (geplanter Beginn ${p.old_start})` : ""} vor Beginn absagen.
    </Text>
    {p.reason ? <Text style={{ whiteSpace: "pre-wrap" }}>{p.reason}</Text> : null}
    <Text>
      {p.child_name ?? "Ihr Kind"} steht wieder auf unserer Warteliste – mit dem ursprünglichen
      Anmeldedatum, sodass kein Platz in der Reihenfolge verloren geht. Sobald ein neuer Kurs
      startet, melden wir uns.
    </Text>
    {p.paid ? <Text>Die bereits gezahlte Kursgebühr erstatten wir Ihnen vollständig.</Text> : null}
  </Frame>
);

export const rescheduleTemplate: TemplateEntry = {
  component: Reschedule,
  displayName: "Kursstart verschoben",
  subject: (d) => `Neuer Kursbeginn: ${d.course_name ?? "Schwimmkurs"} ab ${d.new_start ?? ""}`,
  previewData: {
    parent_name: "Muster",
    child_name: "Mia",
    course_name: "Aufbaukurs",
    old_start: "07.11.2026",
    new_start: "21.11.2026",
  },
};

export const cancelTemplate: TemplateEntry = {
  component: Cancel,
  displayName: "Kurs abgesagt",
  subject: (d) => `Kursabsage: ${d.course_name ?? "Schwimmkurs"}`,
  previewData: {
    parent_name: "Muster",
    child_name: "Mia",
    course_name: "Aufbaukurs",
    old_start: "07.11.2026",
    paid: true,
  },
};
