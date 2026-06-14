// Server-only helper for writing audit log entries. Must only be imported
// inside server function/route handlers.

export type AuditEntry = {
  action: string;
  entity: string;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Write an audit entry using the service-role client so audit records cannot
 * be forged by authenticated end users. INSERT on audit_logs is restricted
 * to service_role at the RLS layer.
 */
export async function logAudit(
  _supabaseUnused: unknown,
  actorId: string,
  entry: AuditEntry,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: actorId,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entity_id ?? null,
      metadata: (entry.metadata ?? null) as never,
    });
  } catch (err) {
    // Never let audit write failure break the originating operation.
    console.error("[audit] failed to write entry", entry, err);
  }
}
