import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logAudit } from "@/lib/audit.server";

// Exporte, die im Browser entstehen (CSV/Excel aus bereits geladenen Daten), hinterlassen sonst keine Spur.
// Diese Funktion schreibt den Export ins Verwaltungsprotokoll; Aktion und Bereich stehen hier fest,
// damit der Browser keine eigenen Protokollnamen vorgeben kann.
const KINDS = {
  trainer_billing: { action: "trainer_billing_exported", entity: "trainer_payout_details" },
  trainer_iban: { action: "trainer_iban_exported", entity: "trainer_payout_details" },
  follow_up_courses: { action: "follow_up_courses_exported", entity: "courses" },
  adult_interest: { action: "adult_interest_exported", entity: "adult_course_interests" },
} as const;

export const logExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z.enum(Object.keys(KINDS) as [keyof typeof KINDS, ...(keyof typeof KINDS)[]]),
        rows: z.number().int().min(0).max(100000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (!isStaff) throw new Response("Forbidden", { status: 403 });
    const k = KINDS[data.kind];
    await logAudit(null, context.userId, {
      action: k.action,
      entity: k.entity,
      metadata: { rows: data.rows },
    });
    return { ok: true as const };
  });
