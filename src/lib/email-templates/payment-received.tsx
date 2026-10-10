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
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { ORG } from "@/lib/billing-config";
import { formatDateBerlin } from "@/lib/format";

interface Props {
  parent_name?: string | null;
  child_name?: string | null;
  program_name?: string | null;
  course_name?: string | null;
  course_starts_on?: string | null;
  course_ends_on?: string | null;
  course_location?: string | null;
  price_amount?: number | null;
  document_no?: string | null;
  site_base_url?: string | null;
}

const row = { margin: "3px 0" } as const;

function Line({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <Text style={row}>
      <strong style={{ display: "inline-block", minWidth: "150px" }}>{label}</strong>
      {value}
    </Text>
  );
}

const Email = (p: Props) => {
  const base = p.site_base_url || "https://sicher-schwimmen.com";
  const title = p.program_name || p.course_name || "Schwimmkurs";
  const period =
    p.course_starts_on || p.course_ends_on
      ? `${formatDateBerlin(p.course_starts_on)} bis ${formatDateBerlin(p.course_ends_on)}`
      : null;
  const amount =
    p.price_amount != null
      ? new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
          Number(p.price_amount),
        )
      : null;
  return (
    <Html lang="de">
      <Head />
      <Preview>Zahlung eingegangen – der Platz für {p.child_name ?? "Ihr Kind"} ist sicher</Preview>
      <Body
        style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" }}
      >
        <Container style={{ padding: "24px", maxWidth: "600px" }}>
          <Text style={{ ...row, fontWeight: "bold", fontSize: "16px" }}>{ORG.name}</Text>
          <Heading style={{ color: "#0c4a6e", fontSize: "20px", marginTop: "18px" }}>
            Zahlung eingegangen
          </Heading>
          <Text>Liebe Eltern,</Text>
          <Text>
            vielen Dank, die Kursgebühr für <strong>{p.child_name ?? "Ihr Kind"}</strong> ist bei
            uns eingegangen. Der Kursplatz ist damit fest für Sie reserviert – Sie müssen nichts
            weiter tun.
          </Text>
          <Section
            style={{ backgroundColor: "#f0f9ff", padding: "12px 16px", borderRadius: "8px" }}
          >
            <Line label="Kurs:" value={title} />
            <Line label="Kurszeitraum:" value={period} />
            <Line label="Kursort:" value={p.course_location} />
            <Line label="Bezahlter Betrag:" value={amount} />
            <Line label="Dokument-Nr.:" value={p.document_no} />
          </Section>
          <Text style={{ marginTop: "16px" }}>
            Kurz vor dem Start erhalten Sie noch eine Erinnerung mit allen Informationen für den
            ersten Kurstag. Falls Ihr Kind doch nicht teilnehmen kann, finden Sie die Regeln zur
            Absage in den{" "}
            <Link href={`${base}/kursbedingungen`} style={{ color: "#0c4a6e" }}>
              Kursteilnahmebedingungen
            </Link>
            .
          </Text>
          <Hr />
          <Text style={{ marginTop: "16px" }}>Herzliche Grüße</Text>
          <Text style={row}>{ORG.signatory}</Text>
          <Text style={{ ...row, fontSize: "12px", color: "#475569" }}>{ORG.name}</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Zahlung eingegangen${d?.child_name ? ` – ${d.child_name}` : ""}`,
  displayName: "Zahlung eingegangen (Eltern)",
  previewData: {
    parent_name: "Erika Beispiel",
    child_name: "Max Beispiel",
    program_name: "Seepferdchen",
    course_starts_on: "2026-10-11",
    course_ends_on: "2026-12-20",
    course_location: "Sportschule Hennef",
    price_amount: 200,
    document_no: "SK-2026-00123",
  },
} satisfies TemplateEntry;
