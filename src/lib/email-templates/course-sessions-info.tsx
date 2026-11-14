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
import { formatDateBerlin } from "@/lib/format";
import { CancellationInfo, SessionList, type MailSession } from "./course-blocks";

interface Props {
  child_name?: string | null;
  course_name?: string | null;
  course_location?: string | null;
  course_schedule?: string | null;
  course_starts_on?: string | null;
  course_ends_on?: string | null;
  time_notice?: string | null;
  sessions?: MailSession[] | null;
  ics_url?: string | null;
  adult?: boolean;
  site_base_url?: string;
}

const row = { margin: "3px 0" as const };

const Email = (p: Props) => {
  const base = p.site_base_url || "https://sicher-schwimmen.com";
  const period =
    p.course_starts_on || p.course_ends_on
      ? `${formatDateBerlin(p.course_starts_on)} bis ${formatDateBerlin(p.course_ends_on)}`
      : null;
  return (
    <Html lang="de">
      <Head />
      <Preview>Die Termine für {p.course_name ?? "Ihren Schwimmkurs"} im Überblick</Preview>
      <Body
        style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" }}
      >
        <Container style={{ padding: "24px", maxWidth: "600px" }}>
          <Text style={{ ...row, fontWeight: "bold", fontSize: "16px" }}>{ORG.name}</Text>
          <Heading style={{ color: "#0c4a6e", fontSize: "20px", marginTop: "18px" }}>
            Ihre Kurstermine im Überblick
          </Heading>
          <Text>{p.adult ? "Guten Tag," : "Liebe Eltern,"}</Text>
          <Text>
            in Ihrer Kursbestätigung
            {p.child_name ? (
              <>
                {" "}
                für <strong>{p.child_name}</strong>
              </>
            ) : null}{" "}
            haben wir nur den Kurszeitraum und den Wochentag genannt. Hier sind die genauen Termine
            des Kurses <strong>{p.course_name ?? "Schwimmkurs"}</strong>. Entschuldigen Sie die
            Unklarheit.
          </Text>
          {(period || p.course_schedule || p.course_location) && (
            <Text style={{ ...row, color: "#475569", fontSize: "13px" }}>
              {[period, p.course_schedule, p.course_location].filter(Boolean).join(" · ")}
            </Text>
          )}
          <SessionList sessions={p.sessions} icsUrl={p.ics_url} notice={p.time_notice} />
          <CancellationInfo startsOn={p.course_starts_on} base={base} />
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
};

export const template = {
  component: Email,
  displayName: "Kurstermine – Übersicht nachgesendet",
  subject: (d: Record<string, any>) => `Ihre Kurstermine – ${d.course_name || "Schwimmkurs"}`,
  previewData: {
    child_name: "Max Beispiel",
    course_name: "Seepferdchen Kurhaus",
    course_location: "Sportschule Hennef",
    course_schedule: "samstags 11:00 - 11:45 Uhr",
    course_starts_on: "2026-11-07",
    course_ends_on: "2027-01-30",
    sessions: [
      { date: "2026-11-07", start: "11:00", end: "11:45" },
      { date: "2026-11-14", start: "11:00", end: "11:45" },
      { date: "2026-11-21", start: "11:00", end: "11:45" },
    ],
    ics_url: "https://sicher-schwimmen.com/api/public/course-ics?course=beispiel",
  },
} satisfies TemplateEntry;
