// Server-only helper for writing audit log entries. Must only be imported
// inside server function/route handlers.
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditEntry = {
  action: string;
  entity: string;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Write an audit entry using the caller's authenticated supabase client so
 * `actor_id = auth.uid()` satisfies the RLS insert policy.
 */
export async function logAudit(
  supabase: SupabaseClient,
  actorId: string,
  entry: AuditEntry,
): Promise<void> {
  try {
    await supabase.from("audit_logs").insert({
      actor_id: actorId,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entity_id ?? null,
      metadata: entry.metadata ?? null,
    });
  } catch (err) {
    // Never let audit write failure break the originating operation.
    console.error("[audit] failed to write entry", entry, err);
  }
}
