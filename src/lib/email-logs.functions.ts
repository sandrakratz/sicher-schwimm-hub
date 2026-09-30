import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EVENT_TYPES = [
  "sent",
  "rejected",
  "bounced",
  "complained",
  "unsubscribed",
  "suppressed",
  "rate_limited",
] as const;

export type DeliveryEvent = {
  timestamp: string;
  recipient: string;
  event_type: string;
  status?: string | undefined;
  message_id?: string | undefined;
  tags?: string[] | null | undefined;
};

/**
 * Versandstatus (versendet / fehlgeschlagen / Rückläufer) aus dem eigenen Sendeprotokoll.
 * Nur für Admin und Vorstand.
 */
export const listDeliveryEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        since: z.string().optional(),
        recipient: z.string().optional(),
        eventType: z.enum(EVENT_TYPES).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { data: roleRows, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Response("Forbidden", { status: 403 });
    const roles = (roleRows || []).map((r: any) => r.role as string);
    if (!roles.includes("admin") && !roles.includes("board")) {
      throw new Response("Forbidden", { status: 403 });
    }

    // Quelle ist unser eigenes Sendeprotokoll (Tabelle email_send_log).
    const STATUS_OF_EVENT: Record<string, string> = {
      sent: "sent",
      rejected: "failed",
      suppressed: "suppressed",
      bounced: "bounced",
      complained: "complained",
    };
    const EVENT_OF_STATUS: Record<string, string> = {
      sent: "sent",
      failed: "rejected",
      suppressed: "suppressed",
      bounced: "bounced",
      complained: "complained",
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("email_send_log")
      .select("id, created_at, recipient_email, status, message_id")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.since) query = query.gte("created_at", data.since);
    if (data.recipient) query = query.ilike("recipient_email", `%${data.recipient}%`);
    if (data.eventType) {
      const status = STATUS_OF_EVENT[data.eventType];
      if (!status) return { events: [] as DeliveryEvent[], historyStartsAt: null as string | null, error: null as string | null };
      query = query.eq("status", status);
    }

    const { data: rows, error } = await query;
    if (error) {
      return {
        events: [] as DeliveryEvent[],
        historyStartsAt: null as string | null,
        error: "Das Sendeprotokoll konnte nicht geladen werden.",
      };
    }
    return {
      events: (rows || []).map((r) => ({
        timestamp: r.created_at,
        recipient: r.recipient_email,
        event_type: EVENT_OF_STATUS[r.status] ?? r.status,
        message_id: r.message_id ?? undefined,
      })) as DeliveryEvent[],
      historyStartsAt: null as string | null,
      error: null as string | null,
    };
  });
