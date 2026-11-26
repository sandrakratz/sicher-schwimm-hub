import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchIn } from "@/lib/fetch-all";
import type { Course, Participant } from "@/components/admin/kurse/shared";
import { useParticipantActions } from "@/components/admin/kurse/useParticipantActions";

export type TransferCourse = {
  id: string;
  name: string;
  schedule: string | null;
  location: string | null;
  free: number | null;
};

/**
 * Lädt die Buchungen einer Familie samt Kursen und Umbuchungszielen und liefert die Aktionen der
 * Teilnehmerliste. Wird einmal auf der Seite aufgerufen, damit Kind-Karten, „Eltern melden sich …“
 * und die Buchungsliste dieselben Daten und Dialoge teilen.
 */
export function useFamilyBookings(
  bookingIds: string[],
  /** Nach jeder Änderung: Familienübersicht (Verlauf, Zähler) neu laden */
  onChanged: () => void,
) {
  const [rows, setRows] = useState<Participant[] | null>(null);
  const [courses, setCourses] = useState<Map<string, Course>>(new Map());
  const [targets, setTargets] = useState<TransferCourse[]>([]);
  const [requestHealth, setRequestHealth] = useState<Record<string, string | null>>({});
  const [requestParent, setRequestParent] = useState<Record<string, string | null>>({});
  const idsKey = bookingIds.join(",");

  const load = useCallback(async () => {
    const ids = idsKey ? idsKey.split(",") : [];
    if (ids.length === 0) {
      setRows([]);
      return;
    }
    const { data: parts } = await supabase.from("course_participants").select("*").in("id", ids);
    const list = ((parts ?? []) as Participant[]).sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? ""),
    );
    // Kurse der Buchungen (für Preise, Fälligkeit, Alter) und alle offenen Kurse als Umbuchungsziele
    const { data: open } = await supabase.from("courses").select("*").is("archived_at", null);
    const ownIds = [...new Set(list.map((p) => p.course_id))];
    const missing = ownIds.filter((id) => !(open ?? []).some((c) => c.id === id));
    const { data: archived } = missing.length
      ? await supabase.from("courses").select("*").in("id", missing)
      : { data: [] };
    const all = [...(open ?? []), ...(archived ?? [])] as unknown as Course[];
    setCourses(new Map(all.map((c) => [c.id, c])));
    const openIds = (open ?? []).map((c) => c.id);
    const confirmed = await fetchIn<{ course_id: string }>(openIds, (chunk, f, t) =>
      supabase
        .from("course_participants")
        .select("course_id")
        .in("course_id", chunk)
        .eq("status", "confirmed")
        .order("id")
        .range(f, t),
    );
    const count = new Map<string, number>();
    for (const r of confirmed) count.set(r.course_id, (count.get(r.course_id) ?? 0) + 1);
    setTargets(
      ((open ?? []) as unknown as Course[]).map((c) => ({
        id: c.id,
        name: c.name,
        schedule: c.schedule,
        location: c.location,
        free: c.max_participants != null ? c.max_participants - (count.get(c.id) ?? 0) : null,
      })),
    );
    const reqIds = list.map((p) => p.request_id).filter(Boolean) as string[];
    if (reqIds.length) {
      const { data: reqs } = await supabase
        .from("course_requests")
        .select("id,health_info,parent_name")
        .in("id", reqIds);
      setRequestHealth(Object.fromEntries((reqs ?? []).map((r) => [r.id, r.health_info])));
      setRequestParent(Object.fromEntries((reqs ?? []).map((r) => [r.id, r.parent_name])));
    }
    setRows(list);
  }, [idsKey]);
  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
    onChanged();
  }, [load, onChanged]);
  const a = useParticipantActions(refresh);
  const editCourse = useMemo(
    () => (a.editPart ? (courses.get(a.editPart.course_id) ?? null) : null),
    [a.editPart, courses],
  );

  return { rows, courses, targets, requestHealth, requestParent, a, editCourse };
}

export type FamilyBookingsState = ReturnType<typeof useFamilyBookings>;
