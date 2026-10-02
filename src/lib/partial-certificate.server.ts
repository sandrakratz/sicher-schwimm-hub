// Server-only: Teilleistungsnachweis speichern und per E-Mail (Download-Link) an Eltern senden.
import { buildPartialCertificate, deDate } from "@/lib/partial-certificate-pdf.server";

export function berlinToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}

/** Sendet genau einmal pro Kind und Kurs. Liefert den Status zurück. */
export async function sendPartialCertificate(
  participantId: string,
  opts: { force?: boolean; senderUserId?: string | null } = {},
): Promise<"sent" | "skipped" | "no_email" | "not_partial" | "failed" | "already_sent"> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const idempotencyKey = `partial-cert-${participantId}`;
  if (!opts.force) {
    const { data: existing } = await supabaseAdmin
      .from("email_send_log")
      .select("id")
      .eq("template_name", "partial-certificate")
      .in("status", ["sent", "pending"])
      .contains("metadata", { idempotency_key: idempotencyKey })
      .limit(1);
    if (existing && existing.length > 0) return "already_sent";
  }
  const today = berlinToday();
  const cert = await buildPartialCertificate(participantId, today);
  if (!cert) return "not_partial";
  if (!cert.email) return "no_email";

  const path = `certificates/${participantId}-${Date.now()}.pdf`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("media")
    .upload(path, cert.bytes, { contentType: "application/pdf", upsert: true });
  if (upErr) return "failed";
  const { data: signed } = await supabaseAdmin.storage
    .from("media")
    .createSignedUrl(path, 70 * 24 * 3600, { download: cert.filename });
  if (!signed?.signedUrl) return "failed";

  const { queueTemplateEmail } = await import("@/lib/email-send.server");
  const res = await queueTemplateEmail({
    templateName: "partial-certificate",
    recipientEmail: cert.email,
    idempotencyKey: opts.force ? `${idempotencyKey}-${Date.now()}` : idempotencyKey,
    metadata: {
      participant_id: participantId,
      course_id: cert.courseId,
      idempotency_key: idempotencyKey,
    },
    senderUserId: opts.senderUserId ?? null,
    templateData: {
      parent_name: cert.parentName,
      child_name: cert.childName,
      level_label: cert.levelLabel,
      deadline: deDate(cert.deadline),
      download_url: signed.signedUrl,
    },
  });
  return res.queued ? "sent" : "failed";
}
