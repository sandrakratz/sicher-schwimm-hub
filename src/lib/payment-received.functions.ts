import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SITE_BASE_URL = "https://sicher-schwimmen.com";
/** Nur frisch eingetragene Zahlungen lösen die Mail aus – nicht das Speichern einer älteren Buchung. */
const FRESH_MINUTES = 15;

/**
 * Schickt den Eltern „Zahlung eingegangen“, nachdem der Vorstand eine Buchung als bezahlt markiert hat.
 * Pro Buchung höchstens einmal (Prüfung im Sendeprotokoll); Rücknahme und erneutes Markieren senden nichts mehr.
 */
export const notifyPaymentReceived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ participantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: staff } = await supabase.rpc("is_staff", { _user_id: userId });
    if (!staff) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("course_participants")
      .select(
        "id,participant_name,participant_email,status,paid,paid_at,price_amount,document_no,request_id,courses!course_participants_course_id_fkey(name,location,starts_on,ends_on,course_programs(name))",
      )
      .eq("id", data.participantId)
      .maybeSingle();
    if (!p) return { sent: false as const, reason: "not_found" };
    if (!p.paid || p.status !== "confirmed") return { sent: false as const, reason: "not_paid" };
    if (!p.participant_email) return { sent: false as const, reason: "no_email" };
    const paidAt = p.paid_at ? new Date(p.paid_at).getTime() : 0;
    if (Date.now() - paidAt > FRESH_MINUTES * 60_000) {
      return { sent: false as const, reason: "not_fresh" };
    }

    const idempotencyKey = `payment-received-${p.id}`;
    const { data: existing } = await supabaseAdmin
      .from("email_send_log")
      .select("id")
      .eq("template_name", "payment-received")
      .contains("metadata", { idempotency_key: idempotencyKey })
      .limit(1);
    if (existing && existing.length > 0) return { sent: false as const, reason: "already_sent" };

    let parentName: string | null = null;
    if (p.request_id) {
      const { data: req } = await supabaseAdmin
        .from("course_requests")
        .select("parent_name")
        .eq("id", p.request_id)
        .maybeSingle();
      parentName = req?.parent_name ?? null;
    }
    const course = (p as any).courses;
    const { queueTemplateEmail } = await import("@/lib/email-send.server");
    const r = await queueTemplateEmail({
      templateName: "payment-received",
      recipientEmail: p.participant_email,
      idempotencyKey,
      senderUserId: userId,
      metadata: { participant_id: p.id },
      templateData: {
        parent_name: parentName,
        child_name: p.participant_name,
        program_name: course?.course_programs?.name ?? null,
        course_name: course?.name ?? null,
        course_starts_on: course?.starts_on ?? null,
        course_ends_on: course?.ends_on ?? null,
        course_location: course?.location ?? null,
        price_amount: p.price_amount,
        document_no: p.document_no,
        site_base_url: SITE_BASE_URL,
      },
    });
    return { sent: r.queued, reason: r.reason };
  });
