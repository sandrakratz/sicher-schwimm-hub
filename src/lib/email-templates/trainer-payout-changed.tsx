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

interface Props {
  trainer_name?: string;
  trainer_email?: string;
  old_iban_masked?: string;
  new_iban_masked?: string;
  iban_changed?: boolean;
  holder_changed?: boolean;
  changed_at?: string;
}

const Email = (p: Props) => (
  <Html lang="de">
    <Head />
    <Preview>Bankverbindung geändert – {p.trainer_name || "Trainer:in"}</Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" }}>
      <Container style={{ padding: "24px", maxWidth: "600px" }}>
        <Heading style={{ color: "#0c4a6e", fontSize: "20px" }}>
          Bankverbindung für Übungsleitergelder geändert
        </Heading>
        <Text>
          <strong>{p.trainer_name || "Eine Trainer:in"}</strong>
          {p.trainer_email ? ` (${p.trainer_email})` : ""} hat die hinterlegte Bankverbindung für
          die Übungsleitergelder geändert.
        </Text>
        <Section style={{ backgroundColor: "#f1f5f9", padding: "14px 16px", borderRadius: "8px" }}>
          <Text style={{ margin: "3px 0" }}>
            <strong>Zeitpunkt:</strong> {formatDateTimeBerlin(p.changed_at)}
          </Text>
          {p.iban_changed && (
            <Text style={{ margin: "3px 0" }}>
              <strong>IBAN:</strong> {p.old_iban_masked || "—"} → {p.new_iban_masked || "—"}
            </Text>
          )}
          {p.holder_changed && (
            <Text style={{ margin: "3px 0" }}>
              <strong>Kontoinhaber:in:</strong> geändert
            </Text>
          )}
        </Section>
        <Hr />
        <Text>
          Die vollständigen Angaben stehen im Verwaltungsbereich unter „Mitglieder &amp; Anträge“ →
          „Übungsleitergelder“. Zum Schutz vor Betrug bitte vor der nächsten Auszahlung kurz bei der
          Trainer:in nachfragen, ob die Änderung beabsichtigt war.
        </Text>
        <Text style={{ fontSize: "12px", color: "#64748b" }}>
          Aus Datenschutzgründen enthält diese Mail nur die letzten vier Stellen der IBAN.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Bankverbindung geändert – ${d.trainer_name || "Trainer:in"}`,
  displayName: "Trainer-Bankverbindung geändert (Vorstand)",
  to: "info@sicher-schwimmen.com",
  previewData: {
    trainer_name: "Max Beispiel",
    trainer_email: "max@example.com",
    old_iban_masked: "DE•• •••• 3000",
    new_iban_masked: "DE•• •••• 4711",
    iban_changed: true,
    holder_changed: false,
    changed_at: new Date().toISOString(),
  },
} satisfies TemplateEntry;
