import * as React from "react";
import { render } from "@react-email/components";
import { createFileRoute } from "@tanstack/react-router";
import { SignupEmail } from "@/lib/email-templates/signup";
import { InviteEmail } from "@/lib/email-templates/invite";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { ReauthenticationEmail } from "@/lib/email-templates/reauthentication";
import {
  EmailSendError,
  SITE_NAME,
  SITE_URL,
  sendWithResend,
  verifyWebhookSignature,
} from "@/lib/email-provider.server";

/**
 * „Send Email“-Hook von Supabase Auth: Anmelde-Mails (Bestätigung, Passwort zurücksetzen, …)
 * werden nicht von Supabase selbst, sondern hier mit unseren eigenen Vorlagen versendet.
 * Einrichtung: Supabase → Authentication → Hooks → Send Email (HTTPS) mit der Adresse
 * https://sicher-schwimmen.com/email/auth-hook. Das dort erzeugte Geheimnis gehört in
 * SEND_EMAIL_HOOK_SECRET.
 */

interface HookPayload {
  user: { email: string; new_email?: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

type TemplateDef = {
  subject: string;
  element: (p: { url: string; token: string; email: string }) => React.ReactElement;
};

const AUTH_TEMPLATES: Record<string, TemplateDef> = {
  signup: {
    subject: "Bitte E-Mail-Adresse bestätigen – Freischaltung durch den Vorstand erforderlich",
    element: ({ url, email }) =>
      React.createElement(SignupEmail, {
        siteName: SITE_NAME,
        siteUrl: SITE_URL,
        recipient: email,
        confirmationUrl: url,
      }),
  },
  invite: {
    subject: "Du wurdest eingeladen",
    element: ({ url }) =>
      React.createElement(InviteEmail, {
        siteName: SITE_NAME,
        siteUrl: SITE_URL,
        confirmationUrl: url,
      }),
  },
  magiclink: {
    subject: "Dein Login-Link",
    element: ({ url }) =>
      React.createElement(MagicLinkEmail, { siteName: SITE_NAME, confirmationUrl: url }),
  },
  recovery: {
    subject: "Passwort zurücksetzen",
    element: ({ url }) =>
      React.createElement(RecoveryEmail, { siteName: SITE_NAME, confirmationUrl: url }),
  },
  reauthentication: {
    subject: "Dein Bestätigungscode",
    element: ({ token }) => React.createElement(ReauthenticationEmail, { token }),
  },
};

function hookError(status: number, message: string) {
  return Response.json({ error: { http_code: status, message } }, { status });
}

export const Route = createFileRoute("/email/auth-hook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["SEND_EMAIL_HOOK_SECRET"];
        const supabaseUrl = process.env["SUPABASE_URL"];
        if (!secret || !supabaseUrl) {
          console.error("auth hook: SEND_EMAIL_HOOK_SECRET oder SUPABASE_URL fehlt");
          return hookError(500, "Server configuration error");
        }

        const rawBody = await request.text();
        if (!(await verifyWebhookSignature(request.headers, rawBody, secret))) {
          return hookError(401, "Invalid signature");
        }

        let payload: HookPayload;
        try {
          payload = JSON.parse(rawBody) as HookPayload;
        } catch {
          return hookError(400, "Invalid body");
        }

        const type = payload.email_data.email_action_type;
        const template = AUTH_TEMPLATES[type];
        if (!template) {
          console.error("auth hook: nicht unterstützter Mailtyp", type);
          return hookError(400, `E-Mail-Typ "${type}" wird nicht unterstützt`);
        }

        const { email } = payload.user;
        const { token, token_hash, redirect_to } = payload.email_data;
        const url =
          `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(token_hash)}` +
          `&type=${encodeURIComponent(type)}&redirect_to=${encodeURIComponent(redirect_to)}`;

        const element = template.element({ url, token, email });
        const html = await render(element);
        const text = await render(element, { plainText: true });

        // Protokoll ohne Inhalt: Bestätigungs- und Reset-Links dürfen nicht in der Datenbank landen.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const logRow = {
          message_id: crypto.randomUUID(),
          template_name: type,
          recipient_email: email,
          subject: template.subject,
        };

        try {
          await sendWithResend({ to: email, subject: template.subject, html, text });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error("auth hook: Versand fehlgeschlagen", message);
          await supabaseAdmin
            .from("email_send_log")
            .insert({ ...logRow, status: "failed", error_message: message.slice(0, 1000) });
          const status = error instanceof EmailSendError && error.status === 429 ? 429 : 500;
          return hookError(status, "E-Mail konnte nicht gesendet werden");
        }

        await supabaseAdmin.from("email_send_log").insert({ ...logRow, status: "sent" });
        return Response.json({});
      },
    },
  },
});
