/* eslint-disable @typescript-eslint/no-explicit-any -- neue Tabellen noch nicht in den generierten Typen */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logAudit } from "@/lib/audit.server";

const TEMPLATE = "member-message-notice";
const INBOX_URL = "https://sicher-schwimmen.com/portal/postfach";
/** So viele Empfänger je Nachricht (Mail-Tageslimit und Aufruf-Limit des Servers). */
export const MAX_RECIPIENTS = 25;

type Ctx = { supabase: any; userId: string };

async function assertStaff(context: Ctx) {
  const { data } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (!data) throw new Error("Nur Admin/Vorstand erlaubt.");
}

export type MessageCandidate = {
  userId: string;
  name: string;
  email: string | null;
  membershipType: string;
};

/** Aktive Mitglieder mit Konto – nur diese können ein Postfach nutzen. */
export const listMessageCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data, error } = await admin
      .from("memberships")
      .select("user_id,first_name,last_name,membership_type,email")
      .eq("status", "active")
      .limit(5000);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];
    const withAccount = rows.filter((m) => m.user_id);
    const ids = [...new Set<string>(withAccount.map((m) => m.user_id))];
    const emails = new Map<string, string | null>();
    if (ids.length) {
      const { data: profs } = await admin.from("profiles").select("id,email").in("id", ids);
      for (const p of (profs ?? []) as any[]) emails.set(p.id, p.email ?? null);
    }
    const seen = new Set<string>();
    const candidates: MessageCandidate[] = [];
    for (const m of withAccount) {
      if (seen.has(m.user_id)) continue;
      seen.add(m.user_id);
      candidates.push({
        userId: m.user_id,
        name: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || "—",
        email: emails.get(m.user_id) ?? m.email ?? null,
        membershipType: m.membership_type,
      });
    }
    candidates.sort((a, b) => a.name.localeCompare(b.name, "de"));
    return { candidates, withoutAccount: rows.length - withAccount.length };
  });

export const sendMemberMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userIds: z
          .array(z.string().uuid())
          .min(1, "Bitte mindestens eine Person wählen.")
          .max(MAX_RECIPIENTS),
        subject: z.string().trim().min(1, "Betreff fehlt.").max(200),
        body: z.string().trim().min(1, "Nachricht fehlt.").max(10000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const userIds = [...new Set(data.userIds)];

    // Nur aktive Mitglieder mit Konto sind zulässig – nie blind der Liste aus dem Browser vertrauen.
    const { data: members, error: memErr } = await admin
      .from("memberships")
      .select("user_id,first_name")
      .eq("status", "active")
      .in("user_id", userIds);
    if (memErr) throw new Error(memErr.message);
    const firstNames = new Map<string, string>();
    for (const m of (members ?? []) as any[]) firstNames.set(m.user_id, m.first_name ?? "");
    const valid = userIds.filter((id) => firstNames.has(id));
    if (valid.length === 0) throw new Error("Keine gültigen Empfänger:innen.");

    const { data: msg, error: msgErr } = await admin
      .from("member_messages")
      .insert({
        sender_user_id: (context as Ctx).userId,
        subject: data.subject,
        body: data.body,
      })
      .select("id")
      .single();
    if (msgErr || !msg)
      throw new Error(msgErr?.message ?? "Nachricht konnte nicht gespeichert werden.");

    const { error: recErr } = await admin
      .from("member_message_recipients")
      .insert(valid.map((user_id) => ({ message_id: msg.id, user_id })));
    if (recErr) {
      await admin.from("member_messages").delete().eq("id", msg.id);
      throw new Error(recErr.message);
    }

    const { data: profs } = await admin.from("profiles").select("id,email").in("id", valid);
    const emailOf = new Map<string, string>();
    for (const p of (profs ?? []) as any[]) if (p.email) emailOf.set(p.id, String(p.email).trim());

    const { queueTemplateEmail } = await import("@/lib/email-send.server");
    let mailed = 0;
    let failed = 0;
    for (const userId of valid) {
      const to = emailOf.get(userId);
      let status: "sent" | "failed" | "skipped" = "skipped";
      if (to) {
        try {
          const res = await queueTemplateEmail({
            templateName: TEMPLATE,
            recipientEmail: to,
            idempotencyKey: `member-message-${msg.id}-${userId}`,
            senderUserId: (context as Ctx).userId,
            templateData: { firstName: firstNames.get(userId) || undefined, url: INBOX_URL },
            metadata: { member_message_id: msg.id },
          });
          status = res.queued ? "sent" : res.reason === "suppressed" ? "skipped" : "failed";
        } catch {
          status = "failed";
        }
      }
      if (status === "sent") mailed += 1;
      if (status === "failed") failed += 1;
      await admin
        .from("member_message_recipients")
        .update({ mail_status: status })
        .eq("message_id", msg.id)
        .eq("user_id", userId);
    }

    await logAudit(null, (context as Ctx).userId, {
      action: "member_message.sent",
      entity: "member_messages",
      entity_id: msg.id,
      metadata: { recipients: valid.length, mailed, failed },
    });

    return { id: msg.id as string, recipients: valid.length, mailed, failed };
  });

export type SentMessage = {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
  recipients: { userId: string; name: string; readAt: string | null; mailStatus: string }[];
};

export const listSentMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SentMessage[]> => {
    await assertStaff(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: msgs, error } = await admin
      .from("member_messages")
      .select("id,subject,body,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const ids = ((msgs ?? []) as any[]).map((m) => m.id);
    if (ids.length === 0) return [];
    const { data: recs } = await admin
      .from("member_message_recipients")
      .select("message_id,user_id,read_at,mail_status")
      .in("message_id", ids);
    const userIds = [...new Set<string>(((recs ?? []) as any[]).map((r) => r.user_id))];
    const names = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await admin
        .from("profiles")
        .select("id,first_name,last_name,email")
        .in("id", userIds);
      for (const p of (profs ?? []) as any[]) {
        names.set(p.id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email || "—");
      }
    }
    return ((msgs ?? []) as any[]).map((m) => ({
      id: m.id,
      subject: m.subject,
      body: m.body,
      createdAt: m.created_at,
      recipients: ((recs ?? []) as any[])
        .filter((r) => r.message_id === m.id)
        .map((r) => ({
          userId: r.user_id,
          name: names.get(r.user_id) ?? "—",
          readAt: r.read_at,
          mailStatus: r.mail_status,
        })),
    }));
  });

export type MyMessage = {
  recipientId: string;
  subject: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export const listMyMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyMessage[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data, error } = await admin
      .from("member_message_recipients")
      .select("id,read_at,created_at,member_messages(subject,body)")
      .eq("user_id", (context as Ctx).userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((r) => ({
      recipientId: r.id,
      subject: r.member_messages?.subject ?? "",
      body: r.member_messages?.body ?? "",
      createdAt: r.created_at,
      readAt: r.read_at,
    }));
  });

export const countMyUnreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await (supabaseAdmin as any)
      .from("member_message_recipients")
      .select("id", { count: "exact", head: true })
      .eq("user_id", (context as Ctx).userId)
      .is("read_at", null);
    return { unread: (count ?? 0) as number };
  });

export const markMyMessageRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ recipientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("member_message_recipients")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.recipientId)
      .eq("user_id", (context as Ctx).userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
