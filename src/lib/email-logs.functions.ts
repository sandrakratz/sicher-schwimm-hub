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

export type DeliveryCounts = { sent: number; failed: number; bounced: number };

const ADMIN_EMAIL = "info@sicher-schwimmen.com";

/**
 * Versandstatus (versendet / fehlgeschlagen / Rückläufer) aus dem eigenen Sendeprotokoll.
 * Die Kennzahlen werden in der Datenbank gezählt (nicht nur über die angezeigten Zeilen), die Liste zeigt
 * die neuesten Einträge. Nur für Admin und Vorstand.
 */
export const listDeliveryEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        since: z.string().optional(),
        recipient: z.string().trim().max(200).optional(),
        recipientType: z.enum(["all", "admin", "external"]).optional(),
        group: z.enum(["all", "sent", "failed", "bounced"]).optional(),
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

    const GROUP_STATUSES: Record<string, string[]> = {
      sent: ["sent"],
      failed: ["failed", "suppressed"],
      bounced: ["bounced", "complained"],
    };
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
    const { escapeLike } = await import("@/lib/like");
    const empty = {
      events: [] as DeliveryEvent[],
      historyStartsAt: null as string | null,
      counts: { sent: 0, failed: 0, bounced: 0 } as DeliveryCounts,
      total: 0,
    };

    // gemeinsame Filter (Zeitraum, Empfänger-Typ, Suchtext)
    const common = <Q extends { gte: any; ilike: any; eq: any; neq: any }>(q: Q): Q => {
      let r: any = q;
      if (data.since) r = r.gte("created_at", data.since);
      if (data.recipient) r = r.ilike("recipient_email", `%${escapeLike(data.recipient)}%`);
      if (data.recipientType === "admin") r = r.ilike("recipient_email", escapeLike(ADMIN_EMAIL));
      if (data.recipientType === "external")
        r = r.not("recipient_email", "ilike", escapeLike(ADMIN_EMAIL));
      return r;
    };
    const count = (statuses: string[]) =>
      common(supabaseAdmin.from("email_send_log").select("id", { count: "exact", head: true })).in(
        "status",
        statuses,
      );

    // Auswahl für die Liste: Gruppe oder einzelner Ereignistyp
    let listStatuses: string[] | null = null;
    if (data.group && data.group !== "all") listStatuses = GROUP_STATUSES[data.group] ?? [];
    if (data.eventType) {
      const status = STATUS_OF_EVENT[data.eventType];
      if (!status) return { ...empty, error: null as string | null };
      listStatuses = [status];
    }

    let listQuery = common(
      supabaseAdmin
        .from("email_send_log")
        .select("id, created_at, recipient_email, status, message_id", { count: "exact" }),
    )
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (listStatuses) listQuery = listQuery.in("status", listStatuses);

    const [list, sent, failed, bounced] = await Promise.all([
      listQuery,
      count(GROUP_STATUSES["sent"]!),
      count(GROUP_STATUSES["failed"]!),
      count(GROUP_STATUSES["bounced"]!),
    ]);
    if (list.error) {
      return { ...empty, error: "Das Sendeprotokoll konnte nicht geladen werden." };
    }
    return {
      events: (list.data || []).map((r) => ({
        timestamp: r.created_at,
        recipient: r.recipient_email,
        event_type: EVENT_OF_STATUS[r.status] ?? r.status,
        message_id: r.message_id ?? undefined,
      })) as DeliveryEvent[],
      historyStartsAt: null as string | null,
      counts: {
        sent: sent.count ?? 0,
        failed: failed.count ?? 0,
        bounced: bounced.count ?? 0,
      } as DeliveryCounts,
      total: list.count ?? 0,
      error: null as string | null,
    };
  });
