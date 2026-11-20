import * as React from "react";
import {
  Body,
  Button,
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
import { BILLING } from "@/lib/billing-config";

interface Props {
  first_name?: string;
  member_name?: string;
  membership_label?: string;
  start_date_label?: string;
  members?: string[];
  fee_annual?: string;
  fee_first_year?: string;
  fee_half?: boolean;
  fee_is_minimum?: boolean;
  login_url?: string;
}

const p = { fontSize: "15px", lineHeight: "1.55" };
const h = { color: "#0c4a6e", fontSize: "16px", margin: "20px 0 6px" };
const small = { fontSize: "13px", color: "#475569", lineHeight: "1.5" };

const Email = ({
  first_name,
  member_name,
  membership_label,
  start_date_label,
  members,
  fee_annual,
  fee_first_year,
  fee_half,
  fee_is_minimum,
  login_url,
}: Props) => (
  <Html lang="de">
    <Head />
    <Preview>
      Aufnahmebestätigung: Ihre Mitgliedschaft bei Sicher-Schwimmen e. V. beginnt am{" "}
      {start_date_label ?? ""}
    </Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" }}>
      <Container style={{ padding: "24px", maxWidth: "600px" }}>
        <Heading style={{ color: "#0c4a6e" }}>Aufnahmebestätigung</Heading>
        <Text style={p}>{first_name ? `Guten Tag ${first_name},` : "Guten Tag,"}</Text>
        <Text style={p}>
          der Vorstand von Sicher-Schwimmen e. V. hat Ihren Antrag geprüft und nimmt
          {member_name ? ` ${member_name}` : " Sie"} als Mitglied auf. Herzlich willkommen!
        </Text>

        <Heading as="h2" style={h}>
          Ihre Mitgliedschaft
        </Heading>
        <Text style={p}>
          Art: <strong>{membership_label}</strong>
          <br />
          Die Mitgliedschaft beginnt am <strong>{start_date_label}</strong>.
          {members && members.length > 0 && (
            <>
              <br />
              Eingeschlossen: {members.join(", ")}
            </>
          )}
        </Text>

        <Heading as="h2" style={h}>
          Beitrag
        </Heading>
        <Text style={p}>
          Jahresbeitrag: {fee_is_minimum ? "mindestens " : ""}
          <strong>{fee_annual}</strong>. Der Beitrag gilt ab dem Beginn der Mitgliedschaft und wird
          per SEPA-Lastschrift von dem Konto eingezogen, das Sie im Antrag angegeben haben. Bei
          Neueintritt erfolgt der Einzug innerhalb von vier Wochen nach dieser Aufnahmebestätigung,
          in den Folgejahren jeweils zum 1. März. Gläubiger-Identifikationsnummer des Vereins:{" "}
          {BILLING.creditorId}.
          {fee_half ? (
            <>
              {" "}
              Da die Mitgliedschaft nach dem 1. Juli beginnt, wird im Beitrittsjahr nur der halbe
              Jahresbeitrag berechnet: <strong>{fee_first_year}</strong>.
            </>
          ) : null}
        </Text>

        <Heading as="h2" style={h}>
          Mitgliedspreis bei Kursen
        </Heading>
        <Text style={p}>
          Für Kurse, die ab dem Beginn der Mitgliedschaft starten, gilt der Mitgliedspreis, auch
          wenn Sie den Kurs schon vorher gebucht haben. Das gilt, solange die Mitgliedschaft zum
          Kursbeginn besteht.
        </Text>

        <Heading as="h2" style={h}>
          Laufzeit und Kündigung
        </Heading>
        <Text style={p}>
          Ab dieser Bestätigung ist die Mitgliedschaft verbindlich. Sie läuft jeweils bis zum Ende
          eines Kalenderjahres. Ein Austritt ist schriftlich gegenüber dem Vorstand mit einer Frist
          von sechs Wochen zum Ende eines Kalenderjahres möglich (§ 5 Satzung). Nach dem Ende der
          Mitgliedschaft gilt für Kurse der Normalpreis.
        </Text>

        <Heading as="h2" style={h}>
          Mitgliederbereich
        </Heading>
        <Text style={p}>
          Im Mitgliederbereich finden Sie Kurse, Termine, Neuigkeiten und Vereinsdokumente.
        </Text>
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
        <Text style={small}>
          Satzung:{" "}
          <Link href="https://sicher-schwimmen.com/satzung">sicher-schwimmen.com/satzung</Link>
          <br />
          Datenschutz:{" "}
          <Link href="https://sicher-schwimmen.com/datenschutz">
            sicher-schwimmen.com/datenschutz
          </Link>
          <br />
          Fragen? Antworten Sie einfach an info@sicher-schwimmen.com.
        </Text>
        <Text style={small}>
          Mit freundlichen Grüßen
          <br />
          Der Vorstand
          <br />
          Sicher-Schwimmen e. V., Bergstr. 67a, 53773 Hennef
          <br />
          Vereinsregister: Amtsgericht Siegburg, VR 4149
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Aufnahmebestätigung – Ihre Mitgliedschaft bei Sicher-Schwimmen e. V.",
  displayName: "Aufnahmebestätigung Mitgliedschaft",
  previewData: {
    first_name: "Sandy",
    member_name: "Familie Muster",
    membership_label: "Familie",
    start_date_label: "01.08.2026",
    members: ["Max Muster", "Mia Muster"],
    fee_annual: "96 €",
    fee_first_year: "48 €",
    fee_half: true,
    fee_is_minimum: false,
    login_url: "https://sicher-schwimmen.com/auth",
  },
} satisfies TemplateEntry;
