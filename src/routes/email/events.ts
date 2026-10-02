import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookSignature } from "@/lib/email-provider.server";

/**
 * Zustell-Ereignisse von Resend (Rückläufer, Spam-Beschwerden). Die Adresse kommt auf die
 * Sperrliste `suppressed_emails`, damit sie keine weiteren Mails mehr bekommt.
 * Einrichtung: Resend → Webhooks → Adresse https://sicher-schwimmen.com/email/events,
 * Ereignisse „email.bounced“ und „email.complained“. Das Signing-Secret gehört in RESEND_WEBHOOK_SECRET.
 */

type Reason = "bounce" | "complaint";

const STATUS: Record<Reason, string> = { bounce: "bounced", complaint: "complained" };
const MESSAGE: Record<Reason, string> = {
  bounce: "Empfänger wurde wegen einer Zustellungs-Rückläufer (Bounce) gesperrt.",
  complaint: "Empfänger wurde wegen einer Spam-Beschwerde gesperrt.",
};

async function record(reason: Reason, recipient: string, eventId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = recipient.toLowerCase();

  const { error: suppressError } = await supabaseAdmin
    .from("suppressed_emails")
    .upsert({ email, reason, metadata: null }, { onConflict: "email" });
  if (suppressError) {
    console.error("Failed to upsert suppressed email", {
      code: suppressError.code,
      message: suppressError.message,
      event_id: eventId,
    });
    throw new Error("suppression_write_failed");
  }

  const { error: logError } = await supabaseAdmin.from("email_send_log").insert({
    message_id: null,
    template_name: "system",
    recipient_email: email,
    status: STATUS[reason],
    error_message: MESSAGE[reason],
    metadata: null,
  });
  if (logError) {
    console.error("Failed to insert email_send_log", {
      code: logError.code,
      message: logError.message,
      event_id: eventId,
    });
    throw new Error("log_write_failed");
  }
}

export const Route = createFileRoute("/email/events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RESEND_WEBHOOK_SECRET"];
        if (!secret) {
          console.error("Missing RESEND_WEBHOOK_SECRET");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        const rawBody = await request.text();
        if (!(await verifyWebhookSignature(request.headers, rawBody, secret))) {
          return Response.json({ error: "Invalid signature" }, { status: 401 });
        }

        const event = JSON.parse(rawBody) as {
          type?: string;
          data?: { to?: string[] | string; email_id?: string };
        };
        const reason: Reason | null =
          event.type === "email.bounced"
            ? "bounce"
            : event.type === "email.complained"
              ? "complaint"
              : null;
        if (!reason) return Response.json({ ok: true, ignored: true });

        const recipients = Array.isArray(event.data?.to)
          ? event.data.to
          : event.data?.to
            ? [event.data.to]
            : [];
        try {
          for (const to of recipients) await record(reason, to, event.data?.email_id ?? "unknown");
        } catch {
          return Response.json({ error: "processing_failed" }, { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
