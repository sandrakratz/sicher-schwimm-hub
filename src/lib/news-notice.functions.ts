/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase-Aufrufe mit JSON-Filtern */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logAudit } from "@/lib/audit.server";
import {
  BATCH_SIZE,
  DAILY_MAIL_BUDGET,
  canNotify,
  newsLink,
  plainPreview,
  recipientEmails,
} from "@/lib/news-notice";

const TEMPLATE = "news-notice";

type Ctx = { supabase: any; userId: string };

async function assertStaff(context: Ctx) {
  const { data } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (!data) throw new Error("Forbidden");
}

async function loadNews(admin: any, newsId: string) {
  const { data, error } = await admin
    .from("news")
    .select("id,title,excerpt,content,visibility,published")
    .eq("id", newsId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Beitrag nicht gefunden.");
  if (!canNotify(data))
    throw new Error(
      "Nur veröffentlichte Beiträge mit Sichtbarkeit „Öffentlich“ oder „Mitglieder“ können per Mail angekündigt werden.",
    );
  return data as {
    id: string;
    title: string;
    excerpt: string | null;
    content: string;
    visibility: string;
    published: boolean;
  };
}

function templateData(n: {
  title: string;
  excerpt: string | null;
  content: string;
  visibility: string;
}) {
  return {
    title: n.title,
    preview: plainPreview(n.excerpt, n.content),
    url: newsLink(n.visibility),
    membersOnly: n.visibility === "members",
  };
}

/** Wie viele Mails darf der Anbieter heute noch senden? */
async function remainingBudget(admin: any): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("email_send_log")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("created_at", since);
  return Math.max(0, DAILY_MAIL_BUDGET - (count ?? 0));
}

async function alreadySentTo(admin: any, newsId: string): Promise<Set<string>> {
  const { data, error } = await admin
    .from("email_send_log")
    .select("recipient_email")
    .eq("template_name", TEMPLATE)
    .in("status", ["sent", "suppressed"])
    .eq("metadata->>news_id", newsId)
    .limit(5000);
  if (error) throw new Error(error.message);
  return new Set<string>(
    (data ?? []).map((r: any) => String(r.recipient_email).trim().toLowerCase()),
  );
}

async function allRecipients(admin: any): Promise<string[]> {
  const { data, error } = await admin
    .from("memberships")
    .select("status,email,guardian_email")
    .eq("status", "active")
    .limit(5000);
  if (error) throw new Error(error.message);
  return recipientEmails(data ?? []);
}

export const getNewsNoticeInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ newsId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const news = await loadNews(admin, data.newsId);
    const [all, sent, budget] = await Promise.all([
      allRecipients(admin),
      alreadySentTo(admin, news.id),
      remainingBudget(admin),
    ]);
    const open = all.filter((e) => !sent.has(e));
    return {
      title: news.title,
      preview: plainPreview(news.excerpt, news.content),
      url: newsLink(news.visibility),
      total: all.length,
      alreadySent: all.length - open.length,
      open: open.length,
      budgetToday: budget,
    };
  });

export const sendNewsNoticeTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ newsId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const news = await loadNews(admin, data.newsId);
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", (context as Ctx).userId)
      .maybeSingle();
    const to = (profile?.email as string | undefined)?.trim();
    if (!to) throw new Error("Für dein Konto ist keine E-Mail-Adresse hinterlegt.");
    const { queueTemplateEmail } = await import("@/lib/email-send.server");
    const res = await queueTemplateEmail({
      templateName: TEMPLATE,
      recipientEmail: to,
      idempotencyKey: `news-notice-test-${news.id}-${Date.now()}`,
      templateData: templateData(news),
      // ohne news_id, damit die Testmail nicht als Versand an ein Mitglied zählt
      metadata: { test: true },
    });
    if (!res.queued) throw new Error(`Testmail nicht gesendet (${res.reason ?? "unbekannt"}).`);
    return { ok: true as const, to };
  });

/**
 * Versendet an die nächsten Empfänger, die diese News noch nicht bekommen haben.
 * Wird vom Browser wiederholt aufgerufen (kleine Portionen), bis nichts mehr offen ist
 * oder das Tageslimit des Mail-Anbieters erreicht ist. Bereits versendete Adressen
 * werden aus dem Sendeprotokoll erkannt – ein Doppelversand ist nicht möglich.
 */
export const sendNewsNoticeBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ newsId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const news = await loadNews(admin, data.newsId);
    const [all, sent, budget] = await Promise.all([
      allRecipients(admin),
      alreadySentTo(admin, news.id),
      remainingBudget(admin),
    ]);
    const open = all.filter((e) => !sent.has(e));
    const take = Math.min(BATCH_SIZE, budget, open.length);

    const { queueTemplateEmail } = await import("@/lib/email-send.server");
    let delivered = 0;
    let skipped = 0;
    for (const to of open.slice(0, take)) {
      const res = await queueTemplateEmail({
        templateName: TEMPLATE,
        recipientEmail: to,
        idempotencyKey: `news-notice-${news.id}-${to}`,
        templateData: templateData(news),
        metadata: { news_id: news.id },
      });
      if (res.queued) delivered += 1;
      else skipped += 1;
    }

    if (delivered > 0 || open.length === 0) {
      await logAudit(null, (context as Ctx).userId, {
        action: "news.notice_sent",
        entity: "news",
        entity_id: news.id,
        metadata: { delivered, skipped },
      });
    }
    // Übersprungene (z. B. gesperrte) Adressen werden nicht erneut versucht: sie stehen als „suppressed“ im Protokoll.
    const remaining = Math.max(0, open.length - take);
    return {
      delivered,
      skipped,
      remaining,
      limitReached: remaining > 0 && budget - take <= 0,
    };
  });
