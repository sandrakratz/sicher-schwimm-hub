import { useEffect, useState } from "react";
import {
  REWE_SFV_ALT,
  REWE_SFV_IMAGE,
  REWE_SFV_TITLE,
  REWE_SFV_URL,
  isReweCampaignActive,
} from "@/lib/rewe-aktion";

type Props = {
  variant?: "inline" | "compact";
  className?: string;
};

/**
 * Zeigt das offizielle REWE-„Scheine für Vereine“-Banner.
 * Rendert nichts mehr, sobald die Aktionslaufzeit abgelaufen ist.
 */
export function ReweSfvBanner({ variant = "inline", className = "" }: Props) {
  // Datumsprüfung erst im Browser, damit kein Build-Stand „einfriert“.
  const [active, setActive] = useState(false);
  useEffect(() => {
    setActive(isReweCampaignActive());
  }, []);

  if (!active) return null;

  const link = (
    <a
      href={REWE_SFV_URL}
      target="_blank"
      rel="noopener noreferrer"
      title={REWE_SFV_TITLE}
      className="inline-block rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <img
        src={REWE_SFV_IMAGE}
        alt={REWE_SFV_ALT}
        width={240}
        height={45}
        loading="lazy"
      />
    </a>
  );

  if (variant === "compact") {
    return <div className={className}>{link}</div>;
  }

  return (
    <div
      className={`rounded-2xl border border-border bg-card px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 ${className}`}
    >
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-primary-deep">
          Unterstützen Sie uns mit Ihren REWE-Scheinen
        </div>
        <p className="text-sm text-muted-foreground">
          Wir nehmen an der Aktion „Scheine für Vereine“ teil. Ihre Scheine
          helfen uns, Material für unsere Schwimmkurse anzuschaffen – noch bis
          zum 11.10.2026 einlösbar.
        </p>
      </div>
      <div className="shrink-0">{link}</div>
    </div>
  );
}
