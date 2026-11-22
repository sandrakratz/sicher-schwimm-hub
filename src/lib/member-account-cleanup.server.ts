// Server-only: Logins gekündigter Mitglieder 30 Tage nach „gültig bis“ löschen.
// Die Mitgliedschaft bleibt als Beleg erhalten (memberships.user_id ist ON DELETE SET NULL, Aufbewahrung 10 Jahre).
import { accountCleanupCutoff, expiredMemberUserIds } from "@/lib/member-account-cleanup";
import { todayBerlinIso } from "@/lib/format";

const PROTECTED_ROLES = ["admin", "board", "trainer"];

export async function deleteExpiredMemberAccounts(): Promise<{
  deleted: number;
  skipped: number;
  failed: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const today = todayBerlinIso();

  // valid_until fehlt noch in der generierten types.ts → untypisierter Zugriff
  const { data: rows, error } = await (supabaseAdmin as any)
    .from("memberships")
    .select("user_id,valid_until")
    .not("user_id", "is", null);
  if (error) throw error;

  const candidates = expiredMemberUserIds(rows ?? [], accountCleanupCutoff(today));
  if (candidates.length === 0) return { deleted: 0, skipped: 0, failed: 0 };

  // Ausnahmen: Konten mit Vorstands-/Trainer-Rolle und Konten mit noch laufenden Kursbuchungen.
  const { data: roles, error: rolesErr } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .in("user_id", candidates)
    .in("role", PROTECTED_ROLES as never);
  if (rolesErr) throw rolesErr;

  const { data: bookings, error: bookingsErr } = await supabaseAdmin
    .from("course_participants")
    .select("parent_user_id,courses!course_participants_course_id_fkey(ends_on)")
    .in("parent_user_id", candidates)
    .is("cancelled_at", null);
  if (bookingsErr) throw bookingsErr;

  const blocked = new Set<string>((roles ?? []).map((r) => r.user_id));
  for (const b of (bookings ?? []) as any[]) {
    const endsOn: string | null = b.courses?.ends_on ?? null;
    if (b.parent_user_id && (!endsOn || endsOn >= today)) blocked.add(b.parent_user_id);
  }

  let deleted = 0;
  let failed = 0;
  const todo = candidates.filter((id) => !blocked.has(id));
  for (const userId of todo) {
    // Einzelfehler (z. B. Verweis aus einer Tabelle ohne ON DELETE) stoppen die übrigen nicht.
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delErr) {
      failed++;
      console.error("[member-account-cleanup] delete failed", { userId, error: delErr.message });
      continue;
    }
    deleted++;
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: null,
      action: "user.deleted_after_membership_end",
      entity: "auth.users",
      entity_id: userId,
      metadata: { cutoff_days: 30 } as never,
    });
  }
  return { deleted, skipped: candidates.length - todo.length, failed };
}
