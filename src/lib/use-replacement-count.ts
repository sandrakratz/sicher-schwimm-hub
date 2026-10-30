import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll, fetchIn } from "@/lib/fetch-all";
import { todayBerlinIso } from "@/lib/format";

/**
 * Wie viele Termine suchen gerade Ersatz (vom Vorstand angefragt, noch nicht voll, ich bin nicht eingeteilt)?
 * Für den Zähler im Menü und auf der Startseite. Bei Fehlern oder fehlender Berechtigung: 0.
 */
export function useReplacementCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const me = u.user?.id;
      if (!me) return;
      let rows = await fetchAll<any>((f, t) =>
        supabase
          .from("course_sessions")
          .select("id,assigned_trainer_id,courses(trainers_needed,trainer_id,archived_at)")
          .not("replacement_requested_at", "is", null)
          .gte("session_date", todayBerlinIso())
          .order("id")
          .range(f, t),
      );
      rows = rows.filter((r) => !r.courses?.archived_at);
      if (rows.length === 0) return setCount(0);
      const assigned = await fetchIn<{ session_id: string; trainer_id: string }>(
        rows.map((r) => r.id),
        (chunk, f, t) =>
          supabase
            .from("course_session_assignments")
            .select("session_id,trainer_id")
            .in("session_id", chunk)
            .order("id")
            .range(f, t),
      );
      const open = rows.filter((r) => {
        const team = new Set<string>(
          assigned.filter((a) => a.session_id === r.id).map((a) => a.trainer_id),
        );
        if (r.assigned_trainer_id) team.add(r.assigned_trainer_id);
        if (r.courses?.trainer_id) team.add(r.courses.trainer_id);
        return !team.has(me) && team.size < (r.courses?.trainers_needed ?? 2);
      });
      if (!cancelled) setCount(open.length);
    })().catch(() => setCount(0));
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return count;
}
