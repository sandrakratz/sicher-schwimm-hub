import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ASSIGNMENT_AREAS = {
  payments: "Zahlungen (offene und überfällige Beiträge)",
  messages: "Nachrichten aus dem Kontaktformular",
  waitlist: "Anfrageliste (Rückfragen, Angebote, Anmeldungen)",
} as const;
export type AssignmentArea = keyof typeof ASSIGNMENT_AREAS;

const SITE = "https://sicher-schwimmen.com";

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data: isStaff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (!isStaff) throw new Error("Forbidden");
}

const fullName = (p: { first_name: string | null; last_name: string | null } | null | undefined) =>
  [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim();

/** Vorstand/Verwaltung, der angemeldete Nutzer und die Standard-Zuständigkeiten. */
export const getAssignmentContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "board"]);
    const ids = [...new Set((roleRows ?? []).map((r) => r.user_id))];
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id,first_name,last_name").in("id", ids)
      : { data: [] as Array<{ id: string; first_name: string | null; last_name: string | null }> };
    const staff = (profs ?? [])
      .map((p) => fullName(p))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "de"));
    const me = fullName((profs ?? []).find((p) => p.id === context.userId)) || null;
    const { data: ruleRows } = await supabaseAdmin.from("assignment_rules").select("area,assignee");
    const rules: Partial<Record<AssignmentArea, string>> = {};
    for (const r of ruleRows ?? []) rules[r.area as AssignmentArea] = r.assignee;
    return { staff, me, rules };
  });

const assignSchema = z.object({
  kind: z.enum(["waitlist", "message", "payment"]),
  id: z.string().uuid(),
  assignee: z.string().trim().max(120).nullable(),
  note: z.string().trim().max(1000).optional(),
});

/**
 * Weist einen Vorgang einem Vorstandsmitglied zu (oder nimmt die Zuweisung zurück). Die Notiz wird
 * am Vorgang vermerkt und steht in der E-Mail an die neue zuständige Person; die Zuweisung (auch das
 * Weitergeben) steht im Audit-Log.
 */
export const assignItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => assignSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { formatDateTimeBerlin } = await import("@/lib/format");

    const table =
      data.kind === "waitlist"
        ? "waitlist_entries"
        : data.kind === "message"
          ? "messages"
          : "course_participants";
    const notesCol = data.kind === "waitlist" ? "admin_notes" : "internal_notes";
    const select =
      data.kind === "waitlist"
        ? "id,assigned_to,admin_notes,child_name,parent_email,parent_name,status"
        : data.kind === "message"
          ? "id,assigned_to,internal_notes,from_name,from_email,subject"
          : "id,assigned_to,internal_notes,participant_name,participant_email,course_id";
    const { data: item } = await (supabaseAdmin as any)
      .from(table)
      .select(select)
      .eq("id", data.id)
      .maybeSingle();
    if (!item) throw new Error("Vorgang nicht gefunden");

    // Namen: ausführende Person und neue zuständige Person (mit E-Mail)
    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("first_name,last_name")
      .eq("id", context.userId)
      .maybeSingle();
    const actor = fullName(me) || "Vorstand";
    const assignee = data.assignee || null;

    const label =
      data.kind === "waitlist"
        ? `Anfrageliste – ${item.child_name}`
        : data.kind === "message"
          ? `Nachricht von ${item.from_name}${item.subject ? `: ${item.subject}` : ""}`
          : `Offene Zahlung – ${item.participant_name ?? "Teilnehmer"}`;
    const url =
      data.kind === "waitlist"
        ? `${SITE}/admin/warteliste?suche=${encodeURIComponent(item.child_name ?? "")}`
        : data.kind === "message"
          ? `${SITE}/admin/nachrichten`
          : `${SITE}/admin/zahlungen`;

    const stamp = formatDateTimeBerlin(new Date().toISOString());
    const noteText = data.note ? ` – Notiz: ${data.note}` : "";
    const line = assignee
      ? `[${stamp}] ${actor} hat den Vorgang ${item.assigned_to ? `von ${item.assigned_to} ` : ""}an ${assignee} zugewiesen${noteText}.`
      : `[${stamp}] ${actor} hat die Zuweisung aufgehoben${noteText}.`;
    const prev = (item[notesCol] as string | null) ?? "";
    const { error } = await (supabaseAdmin as any)
      .from(table)
      .update({ assigned_to: assignee, [notesCol]: prev ? `${prev}\n${line}` : line })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(context.supabase, context.userId, {
      action: "assignment.changed",
      entity: table,
      entity_id: data.id,
      metadata: {
        from: item.assigned_to ?? null,
        to: assignee,
        note: data.note ?? null,
        what: label,
        child: item.child_name ?? item.participant_name ?? item.from_name ?? null,
        email: item.parent_email ?? item.participant_email ?? item.from_email ?? null,
      },
    });

    // Benachrichtigung der neuen zuständigen Person (nicht, wenn man sich selbst zuweist)
    let notified = false;
    if (assignee && assignee !== actor) {
      try {
        const { data: roleRows } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .in("role", ["admin", "board"]);
        const ids = [...new Set((roleRows ?? []).map((r) => r.user_id))];
        const { data: staff } = await supabaseAdmin
          .from("profiles")
          .select("first_name,last_name,email")
          .in("id", ids);
        const target = (staff ?? []).find((p) => fullName(p) === assignee);
        if (target?.email) {
          const { queueTemplateEmail } = await import("@/lib/email-send.server");
          const r = await queueTemplateEmail({
            templateName: "task-assigned",
            recipientEmail: target.email,
            idempotencyKey: `task-assigned-${data.kind}-${data.id}-${Date.now()}`,
            templateData: {
              assignee_name: target.first_name ?? assignee,
              assigned_by: actor,
              what: label,
              note: data.note ?? null,
              url,
            },
          });
          notified = r.queued;
        }
      } catch (err) {
        console.error("task-assigned mail failed", err);
      }
    }
    return { ok: true as const, notified, assignee };
  });

const ruleSchema = z.object({
  area: z.enum(["payments", "messages", "waitlist"]),
  assignee: z.string().trim().max(120).nullable(),
});

/** Standard-Zuständigkeit je Bereich setzen oder löschen. */
export const setAssignmentRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ruleSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.assignee) {
      const { error } = await supabaseAdmin.from("assignment_rules").upsert({
        area: data.area,
        assignee: data.assignee,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("assignment_rules").delete().eq("area", data.area);
      if (error) throw new Error(error.message);
    }
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(context.supabase, context.userId, {
      action: "assignment.rule_changed",
      entity: "assignment_rules",
      entity_id: null,
      metadata: { area: ASSIGNMENT_AREAS[data.area], assignee: data.assignee },
    });
    return { ok: true as const };
  });
