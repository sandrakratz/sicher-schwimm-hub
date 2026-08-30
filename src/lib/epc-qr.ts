// EPC-QR / GiroCode: Datensatz für Überweisungen per Banking-App.
import { BILLING } from "@/lib/billing-config";

export const PAY_QR_BASE_URL = "https://sicher-schwimmen.com";

function sanitize(value: string, max: number): string {
  return (value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Erzeugt den EPC069-12 Datensatz (GiroCode). Empfänger und IBAN stammen immer
 * aus der zentralen Vereinskonfiguration.
 */
export function buildEpcPayload(opts: { amount?: number | null; reference?: string | null }): string | null {
  const iban = BILLING.iban.replace(/\s+/g, "");
  if (!iban) return null;
  const amount = opts.amount != null && Number(opts.amount) > 0 ? Number(opts.amount) : null;
  return [
    "BCD",
    "002",
    "1",
    "SCT",
    BILLING.bic.replace(/\s+/g, ""),
    sanitize(BILLING.recipient, 70),
    iban,
    amount != null ? `EUR${amount.toFixed(2)}` : "",
    "",
    "",
    sanitize(opts.reference || "", 140),
    "",
  ].join("\n");
}

/** Absolute URL zum PNG-QR-Code (für E-Mails nutzbar). */
export function buildPayQrUrl(opts: { amount?: number | null; reference?: string | null }): string | null {
  if (!buildEpcPayload(opts)) return null;
  const params = new URLSearchParams();
  if (opts.amount != null && Number(opts.amount) > 0) params.set("amount", Number(opts.amount).toFixed(2));
  if (opts.reference) params.set("reference", sanitize(opts.reference, 140));
  return `${PAY_QR_BASE_URL}/api/public/pay-qr?${params.toString()}`;
}
