import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseSessionList } from "@/lib/session-list";
import { slugify, type Course, type ProgramRow } from "@/components/admin/kurse/shared";
import type { CourseDialog } from "@/components/admin/kurse/CourseDialog";
import { courseHasAttendance, REPLACE_LOCK_TEXT } from "@/components/admin/kurse/session-records";

/** Kurszeitraum anlegen/bearbeiten (Dialog „Kurs bearbeiten“) inkl. optionaler Terminliste. */
export function useCourseEditor(onSaved: () => Promise<void>, programs: ProgramRow[]) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Course>>({});
  const [sessionText, setSessionText] = useState("");

  function startNewTerm(p: ProgramRow | null) {
    setEditing({
      status: "planned",
      is_public: true,
      program_id: p?.id ?? null,
      name: p?.name ?? "",
      slug: "",
      description: p?.description ?? null,
      target_group: p?.target_group ?? null,
      age_range: p?.age_range ?? null,
      duration: p?.duration ?? null,
      location: p?.location ?? null,
      price_member: p?.price_member ?? 150,
      price_non_member: p?.price_non_member ?? 200,
      payment_due_days: p?.payment_due_days ?? 14,
      course_info: p?.course_info ?? null,
    });
    setOpen(true);
  }

  function startEdit(c: Course) {
    setSessionText("");
    setEditing(c);
    setOpen(true);
  }

  async function save() {
    if (!editing.name) return toast.error("Name erforderlich");
    const parsedList = sessionText.trim() ? parseSessionList(sessionText) : [];
    const realList = parsedList.filter((p) => !p.isBreak);
    if (sessionText.trim() && realList.length === 0)
      return toast.error("In der Terminliste wurden keine Termine erkannt.");
    if (realList.length > 30) return toast.error("Maximal 30 Termine");
    if (realList.length > 0 && editing.id) {
      try {
        if (await courseHasAttendance(editing.id))
          return void toast.error(REPLACE_LOCK_TEXT, { duration: 10000 });
      } catch (e) {
        return void toast.error(e instanceof Error ? e.message : "Anwesenheit nicht prüfbar");
      }
    }
    if (
      realList.length > 0 &&
      editing.id &&
      !window.confirm(
        `Die bisherigen Termine dieses Zeitraums (inkl. Anwesenheit und Trainer-Einteilung) werden durch ${realList.length} neue ersetzt. Fortfahren?`,
      )
    )
      return;
    const payload: Record<string, unknown> = {
      name: editing.name,
      slug:
        editing.slug ||
        slugify(`${editing.name}${editing.starts_on ? ` ${editing.starts_on}` : ""}`),
      description: editing.description || null,
      target_group: editing.target_group || null,
      age_range: editing.age_range || null,
      duration: editing.duration || null,
      location: editing.location || null,
      status: editing.status || "planned",
      max_participants: editing.max_participants ?? null,
      starts_on: editing.starts_on || null,
      ends_on: editing.ends_on || null,
      schedule: editing.schedule || null,
      is_public: editing.is_public ?? true,
      price_member: editing.price_member ?? null,
      price_non_member: editing.price_non_member ?? null,
      payment_due_days: editing.payment_due_days ?? 14,
      program_id: editing.program_id || null,
      unit_count: editing.unit_count ?? null,
      course_info: editing.course_info || null,
      min_participants: editing.min_participants ?? null,
      lanes: editing.lanes ?? null,
      trainers_needed: Math.min(10, Math.max(1, Math.round(Number(editing.trainers_needed) || 2))),
      billed_hours: editing.billed_hours && editing.billed_hours > 0 ? editing.billed_hours : null,
      start_tentative: !!editing.start_tentative,
      tentative_note: editing.tentative_note || null,
      time_notice: editing.time_notice || null,
    };
    if (realList.length > 0) {
      const first = realList[0];
      const last = realList[realList.length - 1];
      payload.starts_on = first.date;
      payload.ends_on = last.date;
      payload.unit_count = realList.length;
      payload.session_breaks = parsedList
        .filter((p) => p.isBreak)
        .map((p) => ({ date: p.date, note: p.note || "kein Termin" }));
      if (!editing.schedule && first.start) {
        const wd = new Date(`${first.date}T12:00:00`)
          .toLocaleDateString("de-DE", { weekday: "short" })
          .replace(".", "");
        payload.schedule = `${wd} ${first.start}${first.end ? `–${first.end}` : ""} Uhr`;
      }
      if (!editing.slug && !editing.id) payload.slug = slugify(`${editing.name} ${first.date}`);
    }

    const res = editing.id
      ? await supabase
          .from("courses")
          .update(payload as never)
          .eq("id", editing.id)
          .select("id")
          .single()
      : await supabase
          .from("courses")
          .insert(payload as never)
          .select("id")
          .single();
    if (res.error) return toast.error(res.error.message);
    const courseId = res.data?.id as string | undefined;
    if (courseId && realList.length > 0) {
      const del = await supabase.from("course_sessions").delete().eq("course_id", courseId);
      if (del.error) return toast.error(del.error.message);
      const ins = await supabase.from("course_sessions").insert(
        realList.map((p, i) => ({
          course_id: courseId,
          session_index: i + 1,
          session_date: p.date,
          start_time: p.start,
          end_time: p.end,
        })),
      );
      if (ins.error) return toast.error(ins.error.message);
    }
    toast.success(
      realList.length ? `Gespeichert – ${realList.length} Termine übernommen` : "Gespeichert",
    );
    setSessionText("");
    setOpen(false);
    await onSaved();
  }

  const dialogProps: Parameters<typeof CourseDialog>[0] = {
    open,
    onOpenChange: setOpen,
    editing,
    setEditing,
    programs,
    sessionText,
    setSessionText,
    onSave: save,
  };

  return { startNewTerm, startEdit, dialogProps };
}
