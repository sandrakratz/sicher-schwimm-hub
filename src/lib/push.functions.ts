import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { escapeLike } from "@/lib/like";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { todayBerlinIso } from "@/lib/format";

const SITE_BASE_URL = "https://sicher-schwimmen.com";
const tokenSchema = z.string().regex(/^[a-f0-9]{20,80}$/);

async function participantByToken(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("course_participants")
    .select(
      "id,participant_name,participant_email,courses!course_participants_course_id_fkey(name)",
    )
    .eq("push_token", token)
    .maybeSingle();
  return data;
}

/** Öffentlich: Infos für die Aktivierungsseite. */
export const getPushInfo = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const { vapidPublicKey } = await import("@/lib/push.server");
    const p = await participantByToken(data.token);
    if (!p) return { found: false as const, publicKey: vapidPublicKey() };
    return {
      found: true as const,
      publicKey: vapidPublicKey(),
      childName: p.participant_name,
      courseName: (p as any).courses?.name ?? null,
    };
  });

const subSchema = z.object({
  token: tokenSchema,
  endpoint: z.string().url().max(1000),
  p256dh: z.string().min(20).max(200),
  auth: z.string().min(8).max(100),
  userAgent: z.string().max(400).optional(),
});

/** Öffentlich (token-basiert): Gerät für alle Buchungen derselben E-Mail aktivieren. */
export const subscribePush = createServerFn({ method: "POST" })
  .inputValidator((d) => subSchema.parse(d))
  .handler(async ({ data }) => {
    const p = await participantByToken(data.token);
    if (!p) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = p.participant_email?.trim();
    let ids = [p.id];
    if (email) {
      const { data: sib } = await supabaseAdmin
        .from("course_participants")
        .select("id")
        .ilike("participant_email", escapeLike(email))
        .neq("status", "cancelled");
      ids = Array.from(new Set([p.id, ...(sib ?? []).map((s) => s.id)]));
    }
    const rows = ids.map((id) => ({
      participant_id: id,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth: data.auth,
      user_agent: data.userAgent ?? null,
    }));
    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(rows, { onConflict: "participant_id,endpoint" });
    if (error) throw new Error(error.message);
    const { sendPush } = await import("@/lib/push.server");
    await sendPush(
      { id: "", endpoint: data.endpoint, p256dh: data.p256dh, auth: data.auth },
      {
        title: "Mitteilungen aktiviert ✓",
        body: "Sie erhalten hier künftig Eilnachrichten zu Ihrem Schwimmkurs.",
        url: "/",
      },
    );
    return { ok: true as const };
  });

export const unsubscribePush = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ token: tokenSchema, endpoint: z.string().url().max(1000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const p = await participantByToken(data.token);
    if (!p) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true as const };
  });

async function assertCourseSender(context: any, courseId: string) {
  const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (staff) return;
  const { data: isTrainer } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "trainer",
  });
  const { data: ofCourse } = await context.supabase.rpc("is_trainer_of_course", {
    _trainer_id: context.userId,
    _course_id: courseId,
  });
  if (!isTrainer || !ofCourse) throw new Error("Forbidden");
}

/** Wie viele Familien eines Kurses sind per Push erreichbar? */
export const countCoursePush = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ courseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCourseSender(context, data.courseId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: parts } = await supabaseAdmin
      .from("course_participants")
      .select("id,participant_email")
      .eq("course_id", data.courseId)
      .eq("status", "confirmed");
    const ids = (parts ?? []).map((p) => p.id);
    if (!ids.length) return { families: 0, recipients: 0 };
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("participant_id")
      .in("participant_id", ids);
    const withSub = new Set((subs ?? []).map((s) => s.participant_id));
    const emails = new Set(
      (parts ?? [])
        .filter((p) => withSub.has(p.id))
        .map((p) => p.participant_email?.trim().toLowerCase()),
    );
    const recipients = new Set(
      (parts ?? []).map((p) => p.participant_email?.trim().toLowerCase()).filter(Boolean),
    ).size;
    return { families: emails.size, recipients };
  });

/** Vorstand: Info-Mail zu Push-Mitteilungen an alle bereits gebuchten Familien (einmalig je Buchung). */
export const sendPushInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { newPushToken } = await import("@/lib/push.server");
    const { queueTemplateEmail } = await import("@/lib/email-send.server");
    const today = todayBerlinIso();
    const { data: parts } = await supabaseAdmin
      .from("course_participants")
      .select(
        "id,participant_name,participant_email,push_token,courses!course_participants_course_id_fkey(name,ends_on,archived_at)",
      )
      .eq("status", "confirmed");
    const seen = new Set<string>();
    let sent = 0;
    for (const p of parts ?? []) {
      const c = (p as any).courses;
      if (!c || c.archived_at || (c.ends_on && c.ends_on < today)) continue;
      const email = p.participant_email?.trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      let token = p.push_token;
      if (!token) {
        token = newPushToken();
        await supabaseAdmin
          .from("course_participants")
          .update({ push_token: token })
          .eq("id", p.id);
      }
      const r = await queueTemplateEmail({
        templateName: "push-invite",
        recipientEmail: p.participant_email!,
        idempotencyKey: `push-invite-${email}`,
        senderUserId: context.userId,
        templateData: {
          child_name: p.participant_name,
          course_name: c.name,
          push_url: `${SITE_BASE_URL}/mitteilungen?token=${token}`,
        },
      });
      if (r.queued) sent++;
    }
    return { sent, families: seen.size };
  });
