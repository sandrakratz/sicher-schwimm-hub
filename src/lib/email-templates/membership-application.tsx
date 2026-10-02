import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { formatDateTimeBerlin } from "@/lib/format";

/** Ergebnis der Formularprüfung beim Absenden des Antrags (alle Werte stammen aus der Prüfung vor dem Speichern). */
interface Checks {
  personal?: boolean;
  address?: boolean;
  sepa?: boolean;
  consents?: boolean;
  minor?: boolean;
  minor_ok?: boolean;
}

interface Props {
  full_name?: string;
  email?: string;
  membership_type?: string;
  phone?: string;
  city?: string;
  checks?: Checks;
  created_at?: string;
}

const okStyle = { margin: "2px 0", color: "#166534" };
const warnStyle = { margin: "2px 0", color: "#b45309", fontWeight: "bold" as const };

function Line({ ok, children }: { ok: boolean | undefined; children: React.ReactNode }) {
  if (ok === undefined) return null;
  return (
    <Text style={ok ? okStyle : warnStyle}>
      {ok ? "✓" : "⚠ Nicht erfüllt:"} {children}
    </Text>
  );
}

const Email = ({ full_name, email, membership_type, phone, city, checks, created_at }: Props) => {
  const allOk = checks
    ? [
        checks.personal,
        checks.address,
        checks.sepa,
        checks.consents,
        checks.minor ? checks.minor_ok : true,
      ].every((v) => v === true)
    : undefined;
  return (
    <Html lang="de">
      <Head />
      <Preview>Neuer Mitgliedsantrag von {full_name || "unbekannt"}</Preview>
      <Body
        style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" }}
      >
        <Container style={{ padding: "24px", maxWidth: "600px" }}>
          <Heading style={{ color: "#0c4a6e" }}>Neuer Mitgliedsantrag</Heading>
          <Text>Es ist ein neuer Mitgliedsantrag eingegangen.</Text>
          <Hr />
          <Section>
            <Text>
              <strong>Name:</strong> {full_name || "—"}
            </Text>
            <Text>
              <strong>E-Mail:</strong> {email || "—"}
            </Text>
            <Text>
              <strong>Telefon:</strong> {phone || "—"}
            </Text>
            <Text>
              <strong>Ort:</strong> {city || "—"}
            </Text>
            <Text>
              <strong>Mitgliedschaftsart:</strong> {membership_type || "—"}
            </Text>
            <Text>
              <strong>Eingegangen am:</strong> {formatDateTimeBerlin(created_at)}
            </Text>
          </Section>
          {checks && (
            <Section
              style={{
                marginTop: "12px",
                backgroundColor: allOk ? "#f0fdf4" : "#fffbeb",
                padding: "12px 16px",
                borderRadius: "8px",
              }}
            >
              <Text style={{ margin: "0 0 4px" }}>
                <strong>Prüfung der Pflichtangaben:</strong>{" "}
                {allOk ? "alle Pflichtfelder ordnungsgemäß ausgefüllt" : "bitte prüfen"}
              </Text>
              <Line ok={checks.personal}>
                Persönliche Daten vollständig (Name, Geburtsdatum, E-Mail, Telefon)
              </Line>
              <Line ok={checks.address}>Anschrift vollständig</Line>
              <Line ok={checks.sepa}>
                SEPA-Lastschriftmandat vollständig erteilt (Kontoinhaber, IBAN, Bank, Ort, Datum,
                Zustimmung)
              </Line>
              <Line ok={checks.consents}>
                Satzung, Mitgliedsordnung und Datenschutzerklärung akzeptiert
              </Line>
              {checks.minor && (
                <Line ok={checks.minor_ok}>
                  Minderjähriges Mitglied: Angaben und Zustimmungen der Erziehungsberechtigten
                  vollständig
                </Line>
              )}
            </Section>
          )}
          <Hr />
          <Text style={{ fontSize: "12px", color: "#64748b" }}>
            Aus Datenschutzgründen stehen Bankdaten (IBAN) nicht in dieser E-Mail. Vollständige
            Daten und SEPA-Mandat im Admin-Bereich unter „Mitgliedschaften".
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Neuer Mitgliedsantrag – ${d.full_name || "Unbekannt"}`,
  displayName: "Mitgliedsantrag (Admin-Benachrichtigung)",
  to: "info@sicher-schwimmen.com",
  previewData: {
    full_name: "Max Mustermann",
    email: "max@example.com",
    membership_type: "aktiv",
    checks: { personal: true, address: true, sepa: true, consents: true, minor: false },
    created_at: new Date().toISOString(),
  },
} satisfies TemplateEntry;
