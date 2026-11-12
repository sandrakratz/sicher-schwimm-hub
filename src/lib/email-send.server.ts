// Server-only Helfer zum Rendern und Versenden von Transaktions-E-Mails über Resend.
import * as React from "react";
import { render } from "@react-email/components";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { EmailSendError, sendWithResend } from "@/lib/email-provider.server";

const ADMIN_EMAIL = "info@sicher-schwimmen.com";
/** Der kostenlose Resend-Tarif erlaubt 100 Mails pro Tag; ab hier warnen wir den Vorstand. */
const DAILY_WARN_AT = 80;
const WARNING_TEMPLATE = "daily-limit-warning";

export interface SendRawEmailOptions {
  /** Label/Vorlagenname für das Sendeprotokoll. */
  templateName: string;
  recipientEmail: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  senderUserId?: string | null;
  replyTo?: string;
  metadata?: Record<string, unknown> | null;
  /**
   * Nur für Serienversand (z. B. Erinnerungen an viele Eltern in einem Lauf): Cloudflare erlaubt im
   * kostenlosen Tarif nur ca. 50 Abfragen pro Aufruf. Mit diesen Optionen spart der Aufrufer die
   * Einzelabfragen pro Mail ein, indem er sie vorab gesammelt erledigt.
   */
  /** Kleingeschriebene gesperrte Adressen, vorab gesammelt abgefragt (statt einer Abfrage pro Mail). */
  knownSuppressed?: Set<string>;
  /** Prüfung „Tageslimit fast erreicht“ nach dem Versand auslassen; der Aufrufer macht sie einmal am Ende. */
  skipLimitWarning?: boolean;
}

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Schickt einmal pro 24 Stunden eine Warnung, wenn das Tageslimit des Mail-Anbieters näher rückt. */
async function warnIfNearDailyLimit(admin: AdminClient) {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("email_send_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("created_at", since);
    if ((count ?? 0) < DAILY_WARN_AT) return;

    const { count: already } = await admin
      .from("email_send_log")
      .select("id", { count: "exact", head: true })
      .eq("template_name", WARNING_TEMPLATE)
      .gte("created_at", since);
    if ((already ?? 0) > 0) return;

    await sendRawEmail({
      templateName: WARNING_TEMPLATE,
      recipientEmail: ADMIN_EMAIL,
      subject: "Hinweis: E-Mail-Tageslimit fast erreicht",
      text:
        `In den letzten 24 Stunden wurden bereits ${count} E-Mails versendet. ` +
        "Der kostenlose Tarif des Mail-Anbieters erlaubt 100 pro Tag. Weitere Mails werden danach abgelehnt, " +
        "bis das Limit wieder frei ist. Falls nötig, kann im Konto des Anbieters ein größerer Tarif gewählt werden.",
      html:
        `<p>In den letzten 24 Stunden wurden bereits <strong>${count}</strong> E-Mails versendet.</p>` +
        "<p>Der kostenlose Tarif des Mail-Anbieters erlaubt 100 pro Tag. Weitere Mails werden danach abgelehnt, " +
        "bis das Limit wieder frei ist. Falls nötig, kann im Konto des Anbieters ein größerer Tarif gewählt werden.</p>",
      idempotencyKey: `${WARNING_TEMPLATE}-${since.slice(0, 13)}`,
    });
  } catch (err) {
    console.error("daily limit warning failed", err);
  }
}

/**
 * Versendet eine bereits gerenderte E-Mail und protokolliert das Ergebnis in
 * `email_send_log` (inkl. Betreff und Inhalt für die Gesprächsverläufe).
 * Adressen, die in `suppressed_emails` stehen (Rückläufer, Beschwerde, Abmeldung), werden übersprungen.
 */
export async function sendRawEmail(
  opts: SendRawEmailOptions,
): Promise<{ sent: boolean; reason?: string; retryable?: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const messageId = crypto.randomUUID();
  const logMetadata = { idempotency_key: opts.idempotencyKey, ...(opts.metadata ?? {}) };

  const logRow = {
    message_id: messageId,
    template_name: opts.templateName,
    recipient_email: opts.recipientEmail,
    subject: opts.subject,
    body_html: opts.html,
    body_text: opts.text,
    sender_user_id: opts.senderUserId ?? null,
    metadata: logMetadata,
  };

  const recipientKey = opts.recipientEmail.trim().toLowerCase();
  let isSuppressed: boolean;
  if (opts.knownSuppressed) {
    isSuppressed = opts.knownSuppressed.has(recipientKey);
  } else {
    const { data: suppressedRow } = await supabaseAdmin
      .from("suppressed_emails")
      .select("id")
      .eq("email", recipientKey)
      .maybeSingle();
    isSuppressed = !!suppressedRow;
  }
  if (isSuppressed) {
    const { error: logErr } = await supabaseAdmin
      .from("email_send_log")
      .insert({ ...logRow, status: "suppressed" });
    if (logErr) console.error("email_send_log insert failed", logErr);
    return { sent: false, reason: "suppressed" };
  }

  try {
    await sendWithResend({
      to: opts.recipientEmail,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
      idempotencyKey: opts.idempotencyKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof EmailSendError && error.code === "not_configured") throw error;
    const { error: logErr } = await supabaseAdmin
      .from("email_send_log")
      .insert({ ...logRow, status: "failed", error_message: message.slice(0, 1000) });
    if (logErr) console.error("email_send_log insert failed", logErr);
    // Ablehnung wegen falscher Adresse o. Ä. (4xx) bringt beim nächsten Versuch nichts;
    // Tageslimit (429) und Ausfälle beim Anbieter (5xx, Netz) dagegen schon.
    const status = error instanceof EmailSendError ? error.status : 0;
    const retryable = !(status >= 400 && status < 500 && status !== 429);
    return { sent: false, reason: "send_failed", retryable };
  }

  const { error: logErr } = await supabaseAdmin
    .from("email_send_log")
    .insert({ ...logRow, status: "sent" });
  if (logErr) console.error("email_send_log insert failed", logErr);

  if (opts.templateName !== WARNING_TEMPLATE && !opts.skipLimitWarning) {
    await warnIfNearDailyLimit(supabaseAdmin);
  }

  return { sent: true };
}

/** Einmalige Prüfung „Tageslimit fast erreicht“ für Aufrufer, die mit `skipLimitWarning` gesendet haben. */
export async function checkDailyLimitWarning(): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await warnIfNearDailyLimit(supabaseAdmin);
}

/**
 * Rendert eine registrierte Vorlage und versendet sie.
 * Rückgabewert bleibt aus Kompatibilitätsgründen `{ queued }`.
 */
export async function queueTemplateEmail(opts: {
  templateName: string;
  recipientEmail?: string | null;
  templateData: Record<string, unknown>;
  idempotencyKey: string;
  senderUserId?: string | null;
  replyTo?: string;
  /** Zusätzliche Metadaten im Sendeprotokoll (z. B. zur Dedupe-Prüfung). */
  metadata?: Record<string, unknown> | null;
  /** Siehe `SendRawEmailOptions`: Einsparung von Abfragen bei Serienversand. */
  knownSuppressed?: Set<string>;
  skipLimitWarning?: boolean;
}): Promise<{ queued: boolean; reason?: string; retryable?: boolean }> {
  const tpl = TEMPLATES[opts.templateName];
  if (!tpl) return { queued: false, reason: "unknown_template" };

  const recipient = (tpl.to || opts.recipientEmail || "").trim();
  if (!recipient) return { queued: false, reason: "no_recipient" };

  const element = React.createElement(tpl.component, opts.templateData as Record<string, unknown>);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof tpl.subject === "function"
      ? tpl.subject(opts.templateData as Record<string, any>)
      : tpl.subject;

  const result = await sendRawEmail({
    templateName: opts.templateName,
    recipientEmail: recipient,
    subject,
    html,
    text,
    idempotencyKey: opts.idempotencyKey,
    senderUserId: opts.senderUserId ?? null,
    replyTo: opts.replyTo,
    metadata: opts.metadata ?? null,
    knownSuppressed: opts.knownSuppressed,
    skipLimitWarning: opts.skipLimitWarning,
  });

  return { queued: result.sent, reason: result.reason, retryable: result.retryable };
}
