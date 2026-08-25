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
 * Versandstatus (zugestellt / fehlgeschlagen / Rückläufer) aus der verwalteten
 * E-Mail-Zustellung. Nur für Admin und Vorstand.
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

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return {
        events: [] as DeliveryEvent[],
        historyStartsAt: null as string | null,
        error: "E-Mail-Protokoll ist derzeit nicht verfügbar.",
      };
    }

    const { listEmailLogs } = await import("@lovable.dev/email-js");
    try {
      const res = await listEmailLogs(
        {
          ...(data.since ? { since: data.since } : {}),
          ...(data.recipient ? { recipient: data.recipient } : {}),
          ...(data.eventType ? { event_type: data.eventType } : {}),
          limit: data.limit ?? 100,
        },
        { apiKey },
      );
      return {
        events: (res.data || []) as DeliveryEvent[],
        historyStartsAt: res.history_starts_at ?? null,
        error: null as string | null,
      };
    } catch (e: any) {
      return {
        events: [] as DeliveryEvent[],
        historyStartsAt: null as string | null,
        error: e?.message ? String(e.message) : "Unbekannter Fehler beim Laden der Zustellereignisse.",
      };
    }
  });
