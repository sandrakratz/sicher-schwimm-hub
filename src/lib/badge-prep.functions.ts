import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CourseBadgePrep } from "@/lib/badge-prep.server";

/**
 * Übersicht für die letzte Kursstunde: Wer bekommt welches Abzeichen, wer den Siggi-Pass.
 * Erlaubt für Admin/Vorstand sowie Trainer:innen des jeweiligen Kurses.
 */
export const getCourseBadgePrep = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) => {
    if (!input?.courseId || typeof input.courseId !== "string") throw new Error("Kurs fehlt.");
    return input;
  })
  .handler(async ({ data, context }): Promise<CourseBadgePrep> => {
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows || []).map((r: { role: string }) => r.role);
    const isStaff = roles.some((r) => ["admin", "board"].includes(r));
    if (!isStaff && !roles.includes("trainer")) throw new Response("Forbidden", { status: 403 });
    if (!isStaff) {
      const { data: allowed } = await context.supabase.rpc("is_trainer_of_course", {
        _trainer_id: context.userId,
        _course_id: data.courseId,
      });
      if (!allowed) throw new Response("Forbidden", { status: 403 });
    }
    const { loadCourseBadgePrep } = await import("@/lib/badge-prep.server");
    const prep = await loadCourseBadgePrep(data.courseId);
    if (!prep) throw new Error("Kurs nicht gefunden.");
    return prep;
  });
