import * as React from "react";
import { Button, Section, Text } from "@react-email/components";

/** Kasten „Notfall-Mitteilungen aufs Handy“ inkl. iPhone-Hinweis. */
export function PushHint({ url }: { url: string }) {
  return (
    <Section
      style={{
        border: "1px solid #bae6fd",
        backgroundColor: "#f0f9ff",
        borderRadius: "8px",
        padding: "14px 16px",
        margin: "18px 0",
      }}
    >
      <Text style={{ margin: "0 0 6px", fontWeight: "bold", fontSize: "15px" }}>
        📱 Notfall-Mitteilungen aufs Handy
      </Text>
      <Text style={{ margin: "0 0 10px", fontSize: "14px" }}>
        Fällt ein Kurstermin kurzfristig aus (z. B. Badschließung), erhalten Sie die Nachricht
        sofort als Mitteilung auf Ihr Smartphone – kostenlos, ohne Konto und ohne dass jemand Ihre
        Handynummer sieht. Bitte öffnen Sie den Link auf Ihrem Handy.
      </Text>
      <Button
        href={url}
        style={{
          backgroundColor: "#0c4a6e",
          color: "#ffffff",
          padding: "10px 16px",
          borderRadius: "6px",
          fontWeight: "bold",
          fontSize: "14px",
        }}
      >
        Mitteilungen aktivieren
      </Button>
      <Text style={{ margin: "12px 0 4px", fontSize: "13px", fontWeight: "bold" }}>
        Wichtig für iPhone-Nutzer:
      </Text>
      <Text style={{ margin: 0, fontSize: "13px" }}>
        1. Link in <strong>Safari</strong> öffnen · 2. unten auf das <strong>Teilen-Symbol</strong>{" "}
        tippen · 3. <strong>„Zum Home-Bildschirm“</strong> wählen · 4. die Seite über das neue
        Symbol öffnen und „Mitteilungen aktivieren“ tippen.
      </Text>
      <Text style={{ margin: "8px 0 0", fontSize: "12px", color: "#475569" }}>
        Ohne diese Schritte erhalten Sie Eilnachrichten ausschließlich per E-Mail.
      </Text>
    </Section>
  );
}
