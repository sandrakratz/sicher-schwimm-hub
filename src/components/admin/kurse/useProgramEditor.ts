import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { slugify, type ProgramRow } from "@/components/admin/kurse/shared";

/**
 * Kursangebot anlegen/bearbeiten. Derselbe Bearbeitungsstand dient dem Dialog „Neues Kursangebot“
 * und dem Reiter „Kursangaben“ auf der Seite des Kursangebots.
 */
export function useProgramEditor(programs: ProgramRow[], onSaved: () => Promise<void>) {
  const [editing, setEditing] = useState<Partial<ProgramRow>>({});
  const [dialogOpen, setDialogOpen] = useState(false);

  function startNew() {
    setEditing({
      is_public: true,
      bookable: true,
      payment_due_days: 14,
      sort_order: (programs.at(-1)?.sort_order ?? 0) + 10,
      price_member: 150,
      price_non_member: 200,
    });
    setDialogOpen(true);
  }

  /** Angaben eines bestehenden Angebots zum Bearbeiten laden (Seite des Kursangebots). */
  function edit(p: ProgramRow | null) {
    setEditing(p ?? {});
  }

  async function save() {
    if (!editing.name) return toast.error("Name erforderlich");
    const slug = editing.slug || slugify(editing.name);
    // Die Adresse erscheint in Links und E-Mails: sprechend, klein geschrieben, mindestens 3 Zeichen
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 3) {
      return toast.error(
        "Adresse (Slug): mindestens 3 Zeichen, nur Kleinbuchstaben, Ziffern und Bindestriche (z. B. „schwimmstarter“).",
      );
    }
    const payload = {
      name: editing.name,
      slug,
      target_group: editing.target_group || null,
      age_range: editing.age_range || null,
      min_age_years: editing.min_age_years ?? null,
      max_age_years: editing.max_age_years ?? null,
      min_swim_level: editing.min_swim_level ?? null,
      weekday: editing.weekday ?? null,
      description: editing.description || null,
      requirements: editing.requirements || null,
      course_info: editing.course_info || null,
      duration: editing.duration || null,
      location: editing.location || null,
      price_member: editing.price_member ?? null,
      price_non_member: editing.price_non_member ?? null,
      payment_due_days: editing.payment_due_days ?? 14,
      is_public: editing.is_public ?? true,
      bookable: editing.bookable ?? true,
      waitlist_open: editing.waitlist_open ?? true,
      sort_order: editing.sort_order ?? 0,
    };
    const res = editing.id
      ? await supabase.from("course_programs").update(payload).eq("id", editing.id)
      : await supabase.from("course_programs").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Kursangebot gespeichert");
    setDialogOpen(false);
    await onSaved();
  }

  /** Löscht das Angebot nach Rückfrage; true, wenn gelöscht. */
  async function remove(p: ProgramRow): Promise<boolean> {
    if (!confirm(`Kursangebot "${p.name}" löschen? Zugeordnete Kurszeiträume bleiben erhalten.`))
      return false;
    const { error } = await supabase.from("course_programs").delete().eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Gelöscht");
    await onSaved();
    return true;
  }

  return {
    editing,
    setEditing,
    dialogOpen,
    setDialogOpen,
    startNew,
    edit,
    save,
    remove,
  };
}

export type ProgramEditor = ReturnType<typeof useProgramEditor>;
