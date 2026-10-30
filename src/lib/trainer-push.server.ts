/* eslint-disable @typescript-eslint/no-explicit-any -- neue Tabellen sind noch nicht in den generierten Typen */
// Server-only: Push-Mitteilungen an Trainer:innen (alle ihre Geräte).
import { sendPush, type PushMessage } from "@/lib/push.server";

/** Sendet an alle Geräte der Person; erloschene Abos werden entfernt. Fehler brechen den Aufrufer nie ab. */
export async function pushToTrainer(trainerId: string, msg: PushMessage): Promise<number> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data, error } = await db
      .from("trainer_push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("trainer_id", trainerId);
    if (error || !data?.length) return 0;
    let ok = 0;
    for (const sub of data) {
      const r = await sendPush(sub, msg);
      if (r === "ok") ok++;
      if (r === "gone") await db.from("trainer_push_subscriptions").delete().eq("id", sub.id);
    }
    return ok;
  } catch (e) {
    console.error("[trainer-push]", e);
    return 0;
  }
}
