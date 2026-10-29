/* eslint-disable @typescript-eslint/no-explicit-any -- gleiche Schreibweise wie die übrigen Verwaltungsfunktionen (Supabase-Kontext, Relationen) */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MemberCheckRow = {
  id: string;
  participant_name: string;
  participant_email: string | null;
  created_at: string;
  course_name: string | null;
  program_name: string | null;
  price_member: number | null;
  price_non_member: number | null;
};

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data: isStaff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (!isStaff) throw new Error("Forbidden");
}

/** Anmeldungen, bei denen "Mitglied" angegeben, aber nicht bestätigt wurde. */
export const listMemberChecks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("course_participants")
      .select(
        "id,participant_name,participant_email,created_at,courses!course_participants_course_id_fkey(name,price_member,price_non_member,course_programs(name,price_member,price_non_member))",
      )
      .eq("member_check", "pending")
      .eq("status", "confirmed")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const rows: MemberCheckRow[] = (data ?? []).map((r: any) => ({
      id: r.id,
      participant_name: r.participant_name,
      participant_email: r.participant_email,
      created_at: r.created_at,
      course_name: r.courses?.name ?? null,
      program_name: r.courses?.course_programs?.name ?? null,
      price_member: r.courses?.price_member ?? r.courses?.course_programs?.price_member ?? null,
      price_non_member:
        r.courses?.price_non_member ?? r.courses?.course_programs?.price_non_member ?? null,
    }));
    return { rows };
  });

export const resolveMemberCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ participantId: z.string().uuid(), decision: z.enum(["confirm", "reject"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context as any);
    const { applyMemberCheck } = await import("@/lib/member-check.server");
    const result = await applyMemberCheck(data.participantId, data.decision, context.userId);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit(context.supabase, context.userId, {
      action: data.decision === "confirm" ? "member_check.confirmed" : "member_check.rejected",
      entity: "course_participants",
      entity_id: data.participantId,
    });
    return result;
  });
