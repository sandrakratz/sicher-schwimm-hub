/* eslint-disable @typescript-eslint/no-explicit-any -- neue Tabellen sind noch nicht in den generierten Typen */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertTeam(context: { supabase: any; userId: string }) {
  const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (staff) return;
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "trainer",
  });
  if (!data) throw new Error("Forbidden");
}

/** Öffentlicher VAPID-Schlüssel für das Abo im Browser. */
export const getTrainerPushKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertTeam(context);
    const { vapidPublicKey } = await import("@/lib/push.server");
    return { publicKey: vapidPublicKey() };
  });

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  p256dh: z.string().min(20).max(200),
  auth: z.string().min(8).max(100),
  userAgent: z.string().max(400).optional(),
});

export const subscribeTrainerPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => subSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertTeam(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const res = await db.from("trainer_push_subscriptions").upsert(
      {
        trainer_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
      },
      { onConflict: "endpoint" },
    );
    if (res.error) throw new Error(res.error.message);
    // Testmitteilung: zeigt sofort, dass es klappt
    const { pushToTrainer } = await import("@/lib/trainer-push.server");
    await pushToTrainer(context.userId, {
      title: "Mitteilungen aktiviert",
      body: "Du bekommst jetzt Bescheid, wenn Ersatz gesucht wird oder sich dein Dienstplan ändert.",
      url: "/trainer",
      tag: "trainer-push-test",
    });
    return { ok: true };
  });

export const unsubscribeTrainerPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ endpoint: z.string().url().max(1000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await (supabaseAdmin as any)
      .from("trainer_push_subscriptions")
      .delete()
      .eq("trainer_id", context.userId)
      .eq("endpoint", data.endpoint);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });
