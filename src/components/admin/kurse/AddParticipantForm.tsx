import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ageAt, fmtDate, type Course, type ProgramRow } from "@/components/admin/kurse/shared";
import type { WaitlistOption } from "@/components/admin/kurse/useParticipants";

const EMPTY = {
  name: "",
  email: "",
  phone: "",
  status: "confirmed" as "confirmed" | "waiting",
  notes: "",
  date_of_birth: "",
};

/** „Teilnehmer hinzufügen“: von Hand oder aus der Warteliste übernommen. */
export function AddParticipantForm({
  course,
  programs,
  waitlist,
  onAdded,
}: {
  course: Course;
  programs: ProgramRow[];
  waitlist: WaitlistOption[];
  onAdded: () => Promise<void>;
}) {
  const [form, setForm] = useState(EMPTY);
  const [pickedId, setPickedId] = useState("");
  // Nach dem Neuladen kann der gewählte Eintrag fehlen (z. B. inzwischen gebucht)
  const picked = waitlist.find((x) => x.id === pickedId);
  const wlPick = picked ? pickedId : "";
  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));

  function pickWaitlist(id: string) {
    setPickedId(id);
    const e = waitlist.find((x) => x.id === id);
    if (!e) return;
    set({
      name: e.child_name || "",
      email: e.parent_email || "",
      phone: e.parent_phone || "",
      date_of_birth: e.child_dob || "",
      notes: e.notes || "",
    });
  }

  async function add() {
    if (!form.name.trim()) return toast.error("Name erforderlich");
    if (!form.date_of_birth) return toast.error("Geburtsdatum erforderlich");
    if (form.status === "waiting" && wlPick) {
      // Der Eintrag steht bereits auf der (einzigen) Warteliste – kein Teilnehmer mit Status „Warteliste“ anlegen
      return toast.info(
        "Dieses Kind steht bereits auf der Warteliste. Zum Einbuchen den Status „Bestätigt“ wählen.",
      );
    }
    if (form.status === "waiting") {
      // Es gibt nur eine Warteliste: Eintrag dort anlegen, damit automatische Angebote greifen
      const { error: wlError } = await supabase.from("waitlist_entries").insert({
        program_id: course.program_id ?? null,
        course_id: course.id,
        child_name: form.name.trim(),
        child_dob: form.date_of_birth,
        parent_name: form.name.trim(),
        parent_email: form.email.trim(),
        parent_phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        gdpr_consent: true,
        status: "waiting",
      });
      if (wlError) return toast.error(wlError.message);
      toast.success("Auf die Warteliste gesetzt");
      setForm(EMPTY);
      await onAdded();
      return;
    }
    const { error } = await supabase.from("course_participants").insert({
      course_id: course.id,
      participant_name: form.name.trim(),
      participant_email: form.email.trim() || null,
      participant_phone: form.phone.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
      date_of_birth: form.date_of_birth || null,
      ...(picked ? { is_member: picked.is_member ?? null } : {}),
    });
    if (error) {
      return toast.error(
        error.code === "23505"
          ? "Dieses Kind ist in diesem Kurs bereits eingetragen."
          : error.message,
      );
    }
    if (wlPick) {
      await supabase
        .from("waitlist_entries")
        .update({
          status: "accepted",
          offer_token: null,
          offer_course_id: course.id,
          responded_at: new Date().toISOString(),
        })
        .eq("id", wlPick);
      setPickedId("");
    }
    toast.success(wlPick ? "Aus der Warteliste übernommen" : "Teilnehmer hinzugefügt");
    setForm(EMPTY);
    await onAdded();
  }

  const age = form.date_of_birth ? ageAt(form.date_of_birth, course.starts_on) : null;

  return (
    <div className="border-t pt-4 mt-4 space-y-3">
      <div className="font-semibold text-sm">Teilnehmer hinzufügen</div>
      {waitlist.length > 0 && (
        <div>
          <Label>Kind aus Warteliste übernehmen</Label>
          <Select value={wlPick} onValueChange={pickWaitlist}>
            <SelectTrigger>
              <SelectValue placeholder={`Aus Warteliste wählen … (${waitlist.length})`} />
            </SelectTrigger>
            <SelectContent>
              {waitlist.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.child_name || "—"}
                  {e.child_dob ? ` (${fmtDate(e.child_dob)})` : ""} ·{" "}
                  {programs.find((p) => p.id === e.program_id)?.name ?? "ohne Angebot"}
                  {e.status === "offered" ? " · Angebot läuft" : ""}
                  {e.fits ? "" : " (anderes Angebot)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground mt-1">
            Füllt die Felder automatisch aus. Beim Hinzufügen wird der Wartelisten-Eintrag als
            gebucht markiert.
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Name *</Label>
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div>
          <Label>Geburtsdatum *</Label>
          <Input
            type="date"
            value={form.date_of_birth}
            onChange={(e) => set({ date_of_birth: e.target.value })}
          />
          {age != null && (
            <div className="text-xs text-muted-foreground mt-1">
              {age} Jahre {course.starts_on ? "bei Kursbeginn" : "(heute)"}
            </div>
          )}
        </div>
        <div>
          <Label>E-Mail</Label>
          <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
        </div>
        <div>
          <Label>Telefon</Label>
          <Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={form.status}
            onValueChange={(v) => set({ status: v as typeof EMPTY.status })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="confirmed">Bestätigt</SelectItem>
              <SelectItem value="waiting">Warteliste</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Notiz</Label>
        <Textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
      </div>
      <Button onClick={add}>
        <Plus className="h-4 w-4" /> Hinzufügen
      </Button>
    </div>
  );
}
