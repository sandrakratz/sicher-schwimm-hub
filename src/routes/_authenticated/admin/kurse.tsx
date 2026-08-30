import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Users, Pencil, Award, Euro, FileSpreadsheet, CalendarDays, Archive, ArchiveRestore, Receipt, FileText, FileArchive, FileDown } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateCourseListXlsx, generateTaxParticipantListXlsx, generateCourseConfirmations, generateMeinVereinCsv } from "@/lib/course-sessions.functions";
import { listTrainers, type TrainerOption } from "@/lib/trainers.functions";
import { getMyAdminRoles } from "@/lib/admin-guard.functions";

export const Route = createFileRoute("/_authenticated/admin/kurse")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/admin-guard.functions");
    const { redirect } = await import("@tanstack/react-router");
    try { await assertHasAnyRole({ data: { roles: ["admin", "board", "trainer"] } }); }
    catch { throw redirect({ to: "/portal" }); }
  },
  component: Page,
});

type Participant = {
  id: string;
  course_id: string;
  user_id: string | null;
  participant_name: string | null;
  participant_email: string | null;
  participant_phone: string | null;
  status: "confirmed" | "waiting" | "cancelled";
  notes: string | null;
  date_of_birth: string | null;
  goal_reached: boolean | null;
  achievement: string | null;
  badge: string | null;
  paid: boolean;
  paid_at: string | null;
  payment_note: string | null;
  is_member: boolean | null;
  member_confirmed: boolean;
  member_confirmed_at: string | null;
  price_amount: number | null;
  created_at?: string | null;
  parent_user_id: string | null;
  request_id: string | null;
};

type CourseRequest = {
  id: string;
  created_at: string;
  status: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string | null;
  child_name: string | null;
  child_dob: string | null;
  swimming_level: string | null;
  desired_course: string | null;
  health_info: string | null;
  message: string | null;
  admin_notes: string | null;
  contact_permission: boolean;
};

const REQUEST_STATUS_LABEL: Record<string, string> = {
  new: "Neu",
  under_review: "In Prüfung",
  contacted: "Kontaktiert",
  accepted: "Angenommen",
  waiting_list: "Warteliste",
  rejected: "Abgelehnt",
};



const ENROLL_STATUS = [
  { value: "confirmed", label: "Bestätigt" },
  { value: "waiting", label: "Warteliste" },
  { value: "cancelled", label: "Abgesagt" },
];
const ENROLL_STATUS_LABEL: Record<string, string> = Object.fromEntries(ENROLL_STATUS.map(o => [o.value, o.label]));

function ageAt(dobStr: string | null | undefined, refStr: string | null | undefined): number | null {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  const ref = refStr ? new Date(refStr) : new Date();
  if (isNaN(dob.getTime()) || isNaN(ref.getTime())) return null;
  let age = ref.getFullYear() - dob.getFullYear();
  const m = ref.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age--;
  return age;
}
import { formatDateBerlin, formatDateTimeBerlin } from "@/lib/format";

function fmtDate(s: string | null | undefined) {
  return formatDateBerlin(s);
}



type Course = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  target_group: string | null;
  age_range: string | null;
  duration: string | null;
  location: string | null;
  trainer_id?: string | null;
  status: "planned" | "open" | "waiting_list" | "fully_booked" | "completed";
  max_participants: number | null;
  starts_on: string | null;
  ends_on: string | null;
  schedule: string | null;
  is_public: boolean;
  price_member: number | null;
  price_non_member: number | null;
  payment_due_days: number | null;
  archived_at: string | null;
  program_id: string | null;
  unit_count: number | null;
};

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{children}</p>;
}

type ProgramRow = {
  id: string;
  name: string;
  slug: string;
  target_group: string | null;
  age_range: string | null;
  min_age_years: number | null;
  description: string | null;
  requirements: string | null;
  duration: string | null;
  location: string | null;
  price_member: number | null;
  price_non_member: number | null;
  payment_due_days: number;
  is_public: boolean;
  bookable: boolean;
  sort_order: number;
};



const STATUS_OPTIONS = [
  { value: "planned", label: "Geplant" },
  { value: "open", label: "Offen" },
  { value: "waiting_list", label: "Warteliste" },
  { value: "fully_booked", label: "Ausgebucht" },
  { value: "completed", label: "Abgeschlossen" },
];
const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map(o => [o.value, o.label]));

function slugify(s: string) {
  return s.toLowerCase().replace(/[äöüß]/g, m => ({ä:"ae",ö:"oe",ü:"ue",ß:"ss"}[m] || m)).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function Page() {
  const [canManage, setCanManage] = useState(true);
  const rolesFn = useServerFn(getMyAdminRoles);
  const [rows, setRows] = useState<Course[]>([]);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [progOpen, setProgOpen] = useState(false);
  const [editingProg, setEditingProg] = useState<Partial<ProgramRow>>({});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Course>>({});
  const [counts, setCounts] = useState<Record<string, { confirmed: number; waiting: number }>>({});
  const [partOpen, setPartOpen] = useState(false);
  const [partCourse, setPartCourse] = useState<Course | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newPart, setNewPart] = useState<{ name: string; email: string; phone: string; status: "confirmed" | "waiting"; notes: string; date_of_birth: string }>({ name: "", email: "", phone: "", status: "confirmed", notes: "", date_of_birth: "" });
  const [editPart, setEditPart] = useState<Participant | null>(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqRow, setReqRow] = useState<CourseRequest | null>(null);

  const [sessOpen, setSessOpen] = useState(false);
  const [sessCourse, setSessCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<{ id: string; session_index: number; session_date: string; assigned_trainer_id?: string | null }[]>([]);
  const [sessAvail, setSessAvail] = useState<{ session_id: string; trainer_id: string; available: boolean }[]>([]);
  const [sessAssign, setSessAssign] = useState<{ session_id: string; trainer_id: string }[]>([]);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const trainersFn = useServerFn(listTrainers);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportingTax, setExportingTax] = useState<string | null>(null);
  const exportXlsx = useServerFn(generateCourseListXlsx);
  const exportTaxXlsx = useServerFn(generateTaxParticipantListXlsx);
  const [exportingConf, setExportingConf] = useState<string | null>(null);
  const exportConfirmationsFn = useServerFn(generateCourseConfirmations);
  const [exportingCsv, setExportingCsv] = useState<string | null>(null);
  const exportMeinVereinFn = useServerFn(generateMeinVereinCsv);

  async function openSessions(c: Course) {
    setSessCourse(c); setSessOpen(true);
    const { data } = await supabase.from("course_sessions")
      .select("id,session_index,session_date,assigned_trainer_id")
      .eq("course_id", c.id).order("session_index", { ascending: true });
    const rows = (data as any[]) || [];
    setSessions(rows as any);
    if (rows.length > 0) {
      const { data: av } = await supabase
        .from("course_session_availability")
        .select("session_id,trainer_id,available")
        .in("session_id", rows.map(r => r.id));
      setSessAvail((av as any) || []);
      const { data: asg } = await supabase
        .from("course_session_assignments")
        .select("session_id,trainer_id")
        .in("session_id", rows.map(r => r.id));
      setSessAssign((asg as any) || []);
    } else {
      setSessAvail([]);
      setSessAssign([]);
    }
    if (trainers.length === 0) {
      try { setTrainers(await trainersFn()); } catch { /* optional */ }
    }
  }

  async function toggleAssignment(sessionId: string, trainerId: string, next: boolean) {
    if (next) {
      const { error } = await supabase
        .from("course_session_assignments")
        .insert({ session_id: sessionId, trainer_id: trainerId });
      if (error) return toast.error(error.message);
      setSessAssign(a => [...a, { session_id: sessionId, trainer_id: trainerId }]);
    } else {
      const { error } = await supabase
        .from("course_session_assignments")
        .delete()
        .eq("session_id", sessionId)
        .eq("trainer_id", trainerId);
      if (error) return toast.error(error.message);
      setSessAssign(a => a.filter(x => !(x.session_id === sessionId && x.trainer_id === trainerId)));
    }
  }

  async function addSession() {
    if (!sessCourse) return;
    if (sessions.length >= 10) return toast.error("Maximal 10 Termine");
    const nextIndex = (sessions.reduce((m, s) => Math.max(m, s.session_index), 0) || 0) + 1;
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("course_sessions").insert({
      course_id: sessCourse.id, session_index: nextIndex, session_date: today,
    });
    if (error) return toast.error(error.message);
    await openSessions(sessCourse);
  }
  async function updateSessionDate(id: string, date: string) {
    const { error } = await supabase.from("course_sessions").update({ session_date: date }).eq("id", id);
    if (error) return toast.error(error.message);
    if (sessCourse) await openSessions(sessCourse);
  }
  async function removeSession(id: string) {
    const { error } = await supabase.from("course_sessions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (sessCourse) await openSessions(sessCourse);
  }

  async function exportCourseList(c: Course) {
    setExporting(c.id);
    try {
      const res = await exportXlsx({ data: { courseId: c.id } });
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = res.filename;
      document.body.appendChild(a); a.click();
      a.remove(); URL.revokeObjectURL(url);
      toast.success("Excel-Kursliste erstellt");
    } catch (e: any) {
      toast.error(e?.message || "Export fehlgeschlagen");
    } finally {
      setExporting(null);
    }
  }

  async function exportTaxList(c: Course) {
    setExportingTax(c.id);
    try {
      const res = await exportTaxXlsx({ data: { courseId: c.id } });
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = res.filename;
      document.body.appendChild(a); a.click();
      a.remove(); URL.revokeObjectURL(url);
      toast.success("Teilnehmerliste (Steuer) erstellt");
    } catch (e: any) {
      toast.error(e?.message || "Export fehlgeschlagen");
    } finally {
      setExportingTax(null);
    }
  }

  async function exportConfirmations(c: Course, format: "pdf" | "zip") {
    setExportingConf(`${c.id}-${format}`);
    try {
      const res = await exportConfirmationsFn({ data: { courseId: c.id, format } });
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: format === "pdf" ? "application/pdf" : "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = res.filename;
      document.body.appendChild(a); a.click();
      a.remove(); URL.revokeObjectURL(url);
      toast.success("Kursbestätigungen erstellt");
    } catch (e: any) {
      toast.error(e?.message || "Export fehlgeschlagen");
    } finally {
      setExportingConf(null);
    }
  }

  async function exportMeinVerein(c: Course) {
    setExportingCsv(c.id);
    try {
      const res = await exportMeinVereinFn({ data: { courseId: c.id } });
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = res.filename;
      document.body.appendChild(a); a.click();
      a.remove(); URL.revokeObjectURL(url);
      toast.success(
        res.missingDocNo > 0
          ? `CSV erstellt (${res.rows} Posten, davon ${res.missingDocNo} ohne Rechnungsnummer)`
          : `CSV erstellt (${res.rows} Posten)`,
      );
    } catch (e: any) {
      toast.error(e?.message || "Export fehlgeschlagen");
    } finally {
      setExportingCsv(null);
    }
  }

  function hasStarted(c: Course) {
    if (c.archived_at) return true;
    if (!c.starts_on) return false;
    const today = new Date().toISOString().slice(0, 10);
    return c.starts_on <= today;
  }

  async function load() {
    let manage = canManage;
    try {
      const { roles } = await rolesFn();
      manage = roles.includes("admin") || roles.includes("board");
      setCanManage(manage);
    } catch { /* keep current */ }

    const { data } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
    let list = (data as Course[]) || [];

    if (!manage) {
      // Trainer: nur eigene Kurse (als Kurstrainer oder einem Termin zugewiesen)
      const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
      const allowed = new Set<string>();
      if (uid) {
        list.forEach(c => { if (c.trainer_id === uid) allowed.add(c.id); });
        const { data: mySessions } = await supabase
          .from("course_sessions")
          .select("id,course_id,assigned_trainer_id");
        const sessions = (mySessions as any[]) || [];
        sessions.forEach(s => { if (s.assigned_trainer_id === uid) allowed.add(s.course_id); });
        const { data: myAssign } = await supabase
          .from("course_session_assignments")
          .select("session_id")
          .eq("trainer_id", uid);
        const assignedSessionIds = new Set(((myAssign as any[]) || []).map(a => a.session_id));
        sessions.forEach(s => { if (assignedSessionIds.has(s.id)) allowed.add(s.course_id); });
      }
      list = list.filter(c => allowed.has(c.id));
    }
    setRows(list);

    const { data: parts } = await supabase.from("course_participants").select("course_id,status");
    const map: Record<string, { confirmed: number; waiting: number }> = {};
    (parts || []).forEach((p: any) => {
      map[p.course_id] = map[p.course_id] || { confirmed: 0, waiting: 0 };
      if (p.status === "confirmed") map[p.course_id].confirmed++;
      else if (p.status === "waiting") map[p.course_id].waiting++;
    });
    setCounts(map);
    const { data: progs } = await supabase.from("course_programs").select("*").order("sort_order", { ascending: true });
    let progList = (progs as ProgramRow[]) || [];
    if (!manage) {
      const usedIds = new Set(list.map(c => c.program_id).filter(Boolean) as string[]);
      progList = progList.filter(p => usedIds.has(p.id));
    }
    setPrograms(progList);
  }
  useEffect(() => { load(); }, []);

  function startNewProgram() {
    setEditingProg({ is_public: true, bookable: true, payment_due_days: 14, sort_order: (programs.at(-1)?.sort_order ?? 0) + 10, price_member: 150, price_non_member: 200 });
    setProgOpen(true);
  }
  function startEditProgram(p: ProgramRow) { setEditingProg(p); setProgOpen(true); }

  async function saveProgram() {
    if (!editingProg.name) return toast.error("Name erforderlich");
    const payload: any = {
      name: editingProg.name,
      slug: editingProg.slug || slugify(editingProg.name),
      target_group: editingProg.target_group || null,
      age_range: editingProg.age_range || null,
      min_age_years: editingProg.min_age_years ?? null,
      description: editingProg.description || null,
      requirements: editingProg.requirements || null,
      duration: editingProg.duration || null,
      location: editingProg.location || null,
      price_member: editingProg.price_member ?? null,
      price_non_member: editingProg.price_non_member ?? null,
      payment_due_days: editingProg.payment_due_days ?? 14,
      is_public: editingProg.is_public ?? true,
      bookable: editingProg.bookable ?? true,
      sort_order: editingProg.sort_order ?? 0,
    };
    const res = editingProg.id
      ? await supabase.from("course_programs").update(payload).eq("id", editingProg.id)
      : await supabase.from("course_programs").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Kursangebot gespeichert");
    setProgOpen(false);
    await load();
  }

  async function removeProgram(p: ProgramRow) {
    if (!confirm(`Kursangebot "${p.name}" löschen? Zugeordnete Kurszeiträume bleiben erhalten.`)) return;
    const { error } = await supabase.from("course_programs").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Gelöscht"); await load();
  }



  async function openRequest(requestId: string) {
    setReqOpen(true);
    setReqRow(null);
    setReqLoading(true);
    const { data, error } = await supabase
      .from("course_requests")
      .select("id,created_at,status,parent_name,parent_email,parent_phone,child_name,child_dob,swimming_level,desired_course,health_info,message,admin_notes,contact_permission")
      .eq("id", requestId)
      .maybeSingle();
    setReqLoading(false);
    if (error) { toast.error(error.message); return; }
    if (!data) { toast.error("Anfrage nicht gefunden"); return; }
    setReqRow(data as CourseRequest);
  }

  async function openParticipants(c: Course) {

    setPartCourse(c); setPartOpen(true);
    const { data } = await supabase.from("course_participants").select("*").eq("course_id", c.id).order("created_at", { ascending: true });
    setParticipants((data as Participant[]) || []);
  }
  async function addParticipant() {
    if (!partCourse) return;
    if (!newPart.name.trim()) return toast.error("Name erforderlich");
    const { error } = await supabase.from("course_participants").insert({
      course_id: partCourse.id,
      participant_name: newPart.name.trim(),
      participant_email: newPart.email.trim() || null,
      participant_phone: newPart.phone.trim() || null,
      status: newPart.status,
      notes: newPart.notes.trim() || null,
      date_of_birth: newPart.date_of_birth || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Teilnehmer hinzugefügt");
    setNewPart({ name: "", email: "", phone: "", status: "confirmed", notes: "", date_of_birth: "" });

    await openParticipants(partCourse);
    await load();
  }
  async function updatePartStatus(p: Participant, status: "confirmed" | "waiting" | "cancelled") {
    const { error } = await supabase.from("course_participants").update({ status }).eq("id", p.id);
    if (error) return toast.error(error.message);
    if (partCourse) await openParticipants(partCourse);
    await load();
  }
  async function removePart(p: Participant) {
    if (!confirm(`Teilnehmer "${p.participant_name}" entfernen?`)) return;
    const { error } = await supabase.from("course_participants").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Entfernt");
    if (partCourse) await openParticipants(partCourse);
    await load();
  }
  async function savePart() {
    if (!editPart) return;
    if (!editPart.participant_name?.trim()) return toast.error("Name erforderlich");
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const memberConfirmedChanged = editPart.member_confirmed && !editPart.member_confirmed_at;
    const { error } = await supabase.from("course_participants").update({
      participant_name: editPart.participant_name.trim(),
      participant_email: editPart.participant_email?.trim() || null,
      participant_phone: editPart.participant_phone?.trim() || null,
      date_of_birth: editPart.date_of_birth || null,
      status: editPart.status,
      notes: editPart.notes?.trim() || null,
      goal_reached: editPart.goal_reached,
      achievement: editPart.achievement?.trim() || null,
      badge: editPart.badge?.trim() || null,
      paid: editPart.paid,
      paid_at: editPart.paid ? (editPart.paid_at || new Date().toISOString()) : null,
      paid_by: editPart.paid ? userId : null,
      payment_note: editPart.payment_note?.trim() || null,
      is_member: editPart.is_member,
      member_confirmed: editPart.member_confirmed,
      member_confirmed_at: editPart.member_confirmed ? (editPart.member_confirmed_at || (memberConfirmedChanged ? new Date().toISOString() : null)) : null,
      member_confirmed_by: editPart.member_confirmed ? userId : null,
      price_amount: editPart.price_amount,
      parent_user_id: editPart.parent_user_id || null,
    }).eq("id", editPart.id);
    if (error) return toast.error(error.message);
    toast.success("Gespeichert");
    setEditPart(null);
    if (partCourse) await openParticipants(partCourse);
    await load();
  }

  async function togglePaid(p: Participant, paid: boolean) {
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const { error } = await supabase.from("course_participants").update({
      paid,
      paid_at: paid ? new Date().toISOString() : null,
      paid_by: paid ? userId : null,
    }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(paid ? "Als bezahlt markiert" : "Zahlung zurückgesetzt");
    if (partCourse) await openParticipants(partCourse);
  }


  function startNew() { setEditing({ status: "planned", is_public: true, price_member: 150, price_non_member: 200, payment_due_days: 14 }); setOpen(true); }
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
    });
    setOpen(true);
  }
  function startEdit(c: Course) { setEditing(c); setOpen(true); }

  async function save() {
    if (!editing.name) return toast.error("Name erforderlich");
    const payload: any = {
      name: editing.name,
      slug: editing.slug || slugify(`${editing.name}${editing.starts_on ? ` ${editing.starts_on}` : ""}`),
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
    };


    const res = editing.id
      ? await supabase.from("courses").update(payload).eq("id", editing.id)
      : await supabase.from("courses").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Gespeichert");
    setOpen(false);
    await load();
  }

  async function remove(c: Course) {
    if (!confirm(`Kurs "${c.name}" löschen?`)) return;
    const { error } = await supabase.from("courses").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Gelöscht"); await load();
  }

  async function archive(c: Course) {
    if (!confirm(`Kurs "${c.name}" archivieren?`)) return;
    const { error } = await supabase.from("courses").update({ archived_at: new Date().toISOString() }).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Kurs archiviert"); await load();
  }

  async function unarchive(c: Course) {
    const { error } = await supabase.from("courses").update({ archived_at: null }).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Kurs wiederhergestellt"); await load();
  }

  const detailProgram = detailId ? programs.find(p => p.id === detailId) ?? null : null;

  function termsOf(programId: string | null) {
    return rows.filter(r => (programId === null ? !r.program_id : r.program_id === programId));
  }

  function renderTermRow(c: Course) {
    const cnt = counts[c.id] || { confirmed: 0, waiting: 0 };
    const max = c.max_participants;
    const full = max != null && cnt.confirmed >= max;
    return (
      <TableRow key={c.id} className={c.archived_at ? "opacity-70" : ""}>
        <TableCell className="text-xs whitespace-nowrap">
          <div className="font-medium text-sm">{fmtDate(c.starts_on) || "—"} – {fmtDate(c.ends_on) || "—"}</div>
          <div className="text-muted-foreground">{c.name}{!c.is_public && " · intern"}{c.archived_at && " · archiviert"}</div>
        </TableCell>
        <TableCell className="text-xs">{c.schedule || "—"}</TableCell>
        <TableCell><Badge variant="secondary">{STATUS_LABEL[c.status] || c.status}</Badge></TableCell>
        <TableCell className="text-xs whitespace-nowrap">
          <span className={full ? "text-destructive font-semibold" : "font-semibold"}>{cnt.confirmed}</span>
          {max != null ? <> / {max}</> : null}
          {cnt.waiting > 0 && <span className="ml-2 text-muted-foreground">(+{cnt.waiting} WL)</span>}
        </TableCell>
        <TableCell className="text-right whitespace-nowrap">
          <Button variant="ghost" size="sm" onClick={() => openParticipants(c)}><Users className="h-4 w-4" /> Teilnehmer</Button>
          <Button variant="ghost" size="sm" onClick={() => openSessions(c)}><CalendarDays className="h-4 w-4" /> Termine</Button>
          <Button variant="ghost" size="sm" disabled={exporting === c.id} onClick={() => exportCourseList(c)}><FileSpreadsheet className="h-4 w-4" /> {exporting === c.id ? "Erstelle…" : "Excel"}</Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={exportingTax === c.id || !hasStarted(c)}
            title={hasStarted(c) ? "Teilnehmerliste mit allen Daten für die Steuer" : "ab Kursbeginn verfügbar"}
            onClick={() => exportTaxList(c)}
          ><Receipt className="h-4 w-4" /> {exportingTax === c.id ? "Erstelle…" : "Steuerliste"}</Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={exportingConf === `${c.id}-pdf`}
            title="Alle Kursbestätigungen als ein PDF"
            onClick={() => exportConfirmations(c, "pdf")}
          ><FileText className="h-4 w-4" /> {exportingConf === `${c.id}-pdf` ? "Erstelle…" : "Bestätigungen (PDF)"}</Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={exportingConf === `${c.id}-zip`}
            title="Kursbestätigungen einzeln als ZIP"
            onClick={() => exportConfirmations(c, "zip")}
          ><FileArchive className="h-4 w-4" /> {exportingConf === `${c.id}-zip` ? "Erstelle…" : "ZIP"}</Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={exportingCsv === c.id}
            title="Rechnungsposten als CSV für WISO MeinVerein Web"
            onClick={() => exportMeinVerein(c)}
          ><FileDown className="h-4 w-4" /> {exportingCsv === c.id ? "Erstelle…" : "MeinVerein (CSV)"}</Button>
          {canManage && <>
            <Button variant="ghost" size="sm" onClick={() => startEdit(c)}><Pencil className="h-4 w-4" /> Bearbeiten</Button>
            {c.archived_at
              ? <Button variant="ghost" size="sm" onClick={() => unarchive(c)}><ArchiveRestore className="h-4 w-4" /></Button>
              : <Button variant="ghost" size="sm" onClick={() => archive(c)}><Archive className="h-4 w-4" /></Button>}
            <Button variant="ghost" size="sm" onClick={() => remove(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </>}
        </TableCell>
      </TableRow>
    );
  }

  function renderTermTable(programId: string | null) {
    const all = termsOf(programId);
    const active = all.filter(t => !t.archived_at);
    const archived = all.filter(t => !!t.archived_at);
    const visible = showArchived ? [...active, ...archived] : active;
    return (
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zeitraum</TableHead>
              <TableHead>Zeitplan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plätze</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0
              ? <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-xs">Noch keine Kurszeiträume.</TableCell></TableRow>
              : visible.map(renderTermRow)}
          </TableBody>
        </Table>
        {archived.length > 0 && (
          <div className="border-t p-2 text-xs">
            <Button variant="ghost" size="sm" onClick={() => setShowArchived(v => !v)}>
              <Archive className="h-4 w-4" /> {showArchived ? "Archivierte ausblenden" : `Archivierte anzeigen (${archived.length})`}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const unassigned = termsOf(null);

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary-deep">{canManage ? "Kursverwaltung" : "Meine Kurse"}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{canManage
            ? "Auf einen Kurs klicken, um alle Angaben zu bearbeiten und neue Zeiträume anzulegen. Öffentliche Kurse erscheinen automatisch in der Kursübersicht der Webseite."
            : "Hier siehst du nur die Kurse, in denen du als Trainer eingetragen bist."}</p>
        </div>
        {canManage && <Button onClick={startNewProgram}><Plus className="h-4 w-4" /> Neuer Kurs</Button>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {programs.length === 0 && unassigned.length === 0 && (
          <Card className="border-0 shadow-soft md:col-span-2 xl:col-span-3">
            <CardContent className="py-10 text-center text-muted-foreground text-sm">{canManage ? "Noch keine Kurse angelegt." : "Du bist derzeit in keinen Kurs eingeteilt."}</CardContent>
          </Card>
        )}

        {programs.map(p => {
          const terms = termsOf(p.id).filter(t => !t.archived_at);
          const confirmed = terms.reduce((s, t) => s + (counts[t.id]?.confirmed ?? 0), 0);
          const capacity = terms.reduce((s, t) => s + (t.max_participants ?? 0), 0);
          const bookable = terms.filter(t => t.max_participants == null || (counts[t.id]?.confirmed ?? 0) < t.max_participants).length;
          return (
            <Card
              key={p.id}
              className="border-0 shadow-soft cursor-pointer transition hover:shadow-lg"
              onClick={() => { setEditingProg(p); setDetailId(p.id); }}
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display text-lg font-semibold text-primary-deep">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.location || "Ort offen"}</div>
                  </div>
                  {!p.is_public && <Badge variant="secondary" className="text-xs">Intern</Badge>}
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>{p.age_range || "Alter offen"}{p.min_age_years != null ? ` (min. ${p.min_age_years} J.)` : ""}</div>
                  <div><Euro className="inline h-3 w-3 mr-1" />{p.price_non_member ?? "—"} € / {p.price_member ?? "—"} € (Mitgl.)</div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{terms.length} Zeiträume</Badge>
                  <Badge variant="outline">{bookable} buchbar</Badge>
                  <Badge variant="outline">{confirmed}{capacity > 0 ? ` / ${capacity}` : ""} Plätze belegt</Badge>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setEditingProg(p); setDetailId(p.id); }}>Öffnen</Button>
                  {canManage && <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); startNewTerm(p); }}><Plus className="h-4 w-4" /> Neuer Zeitraum</Button>}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {unassigned.length > 0 && (
          <Card className="border-0 shadow-soft cursor-pointer transition hover:shadow-lg" onClick={() => { setEditingProg({}); setDetailId("unassigned"); }}>
            <CardContent className="p-5 space-y-3">
              <div className="font-display text-lg font-semibold text-primary-deep">Ohne Kursangebot</div>
              <p className="text-xs text-muted-foreground">Zeiträume, die keinem Kurs zugeordnet sind und daher nicht auf der Webseite erscheinen.</p>
              <Badge variant="outline" className="text-xs">{unassigned.length} Zeiträume</Badge>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={detailId !== null} onOpenChange={o => { if (!o) setDetailId(null); }}>
        <DialogContent className="w-[95vw] max-w-[1100px] sm:max-w-[1100px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailId === "unassigned" ? "Zeiträume ohne Kursangebot" : detailProgram?.name || "Kurs"}</DialogTitle>
          </DialogHeader>

          {canManage && detailId !== "unassigned" && detailProgram && (
            <div className="space-y-3 border rounded-md p-4">
              <div>
                <div className="font-semibold text-sm">Kursangaben (gelten für alle Zeiträume)</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Diese Angaben steuern die öffentliche Darstellung: die Kurskarte in der Kursübersicht (/kurse) und die Detailseite
                  (/kurse/{editingProg.slug || detailProgram.slug}). Kurszeiträume, Termine und Buchbarkeit werden weiter unten je Zeitraum gepflegt.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><Label>Name *</Label><Input value={editingProg.name || ""} onChange={e => setEditingProg(p => ({ ...p, name: e.target.value }))} /></div>
                <div><Label>Slug (URL)</Label><Input value={editingProg.slug || ""} onChange={e => setEditingProg(p => ({ ...p, slug: e.target.value }))} /><Hint>Adresse der Detailseite: /kurse/{editingProg.slug || "…"} – nachträgliches Ändern verändert bestehende Links.</Hint></div>
              </div>
              <div><Label>Ort</Label><Input value={editingProg.location || ""} onChange={e => setEditingProg(p => ({ ...p, location: e.target.value }))} /><Hint>Ortszeile auf Kurskarte und Detailseite. Einzelne Zeiträume können unten einen abweichenden Ort haben.</Hint></div>
              <div><Label>Beschreibung</Label><Textarea rows={3} value={editingProg.description || ""} onChange={e => setEditingProg(p => ({ ...p, description: e.target.value }))} /><Hint>Erster Absatz = Kurztext in der Kursübersicht /kurse und Einleitung oben auf der Detailseite. Weitere Absätze (durch Leerzeile trennen) erscheinen nur auf der Detailseite.</Hint></div>
              <div><Label>Voraussetzungen</Label><Textarea rows={2} value={editingProg.requirements || ""} onChange={e => setEditingProg(p => ({ ...p, requirements: e.target.value }))} /><Hint>Kursübersicht: kurz unter „Voraussetzungen" bzw. bei geplanten Angeboten als „Rahmen". Detailseite: eigener Abschnitt. Jede Zeile wird zu einem Aufzählungspunkt.</Hint></div>
              <div className="grid sm:grid-cols-4 gap-3">
                <div><Label>Zielgruppe</Label><Input value={editingProg.target_group || ""} onChange={e => setEditingProg(p => ({ ...p, target_group: e.target.value }))} /><Hint>Badge oben auf der Kurskarte und in der Infobox der Detailseite.</Hint></div>
                <div><Label>Altersangabe</Label><Input value={editingProg.age_range || ""} onChange={e => setEditingProg(p => ({ ...p, age_range: e.target.value }))} /><Hint>Blaue Zeile unter dem Kursnamen (Kursübersicht) und Infobox (Detailseite).</Hint></div>
                <div><Label>Mindestalter (Jahre)</Label><Input type="number" value={editingProg.min_age_years ?? ""} onChange={e => setEditingProg(p => ({ ...p, min_age_years: e.target.value === "" ? null : Number(e.target.value) }))} /><Hint>Nur Detailseite (Hinweis bei den Voraussetzungen) und Prüfung bei der Buchung.</Hint></div>
                <div><Label>Dauer</Label><Input value={editingProg.duration || ""} onChange={e => setEditingProg(p => ({ ...p, duration: e.target.value }))} /><Hint>Uhr-Zeile auf Kurskarte und Detailseite (z. B. „8 Termine · ca. 40 Minuten").</Hint></div>
              </div>
              <div className="grid sm:grid-cols-4 gap-3 items-end">
                <div><Label>Preis Nicht-Mitglied (€)</Label><Input type="number" value={editingProg.price_non_member ?? ""} onChange={e => setEditingProg(p => ({ ...p, price_non_member: e.target.value === "" ? null : Number(e.target.value) }))} /><Hint>Preiszeile auf Kurskarte und Detailseite.</Hint></div>
                <div><Label>Preis Mitglied (€)</Label><Input type="number" value={editingProg.price_member ?? ""} onChange={e => setEditingProg(p => ({ ...p, price_member: e.target.value === "" ? null : Number(e.target.value) }))} /><Hint>Preiszeile auf Kurskarte und Detailseite.</Hint></div>
                <div><Label>Zahlungsziel (Tage)</Label><Input type="number" value={editingProg.payment_due_days ?? 14} onChange={e => setEditingProg(p => ({ ...p, payment_due_days: Number(e.target.value) }))} /><Hint>Nicht öffentlich sichtbar – wird in Buchungsbestätigung und Rechnungstext genutzt.</Hint></div>
                <div><Label>Sortierung</Label><Input type="number" value={editingProg.sort_order ?? 0} onChange={e => setEditingProg(p => ({ ...p, sort_order: Number(e.target.value) }))} /><Hint>Reihenfolge der Karten in der Kursübersicht (kleine Zahl zuerst).</Hint></div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={editingProg.is_public ?? true} onCheckedChange={v => setEditingProg(p => ({ ...p, is_public: Boolean(v) }))} />
                  Auf der Webseite anzeigen
                  <span className="text-[11px] text-muted-foreground">(Karte in /kurse + eigene Detailseite)</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={editingProg.bookable ?? true} onCheckedChange={v => setEditingProg(p => ({ ...p, bookable: Boolean(v) }))} />
                  Online buchbar
                  <span className="text-[11px] text-muted-foreground">(aus: Status „Geplant – noch nicht buchbar", keine Buchung)</span>
                </label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { removeProgram(detailProgram); setDetailId(null); }}><Trash2 className="h-4 w-4 text-destructive" /> Kurs löschen</Button>
                  <Button onClick={saveProgram}>Kursangaben speichern</Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-sm">Kurszeiträume</div>
              {canManage && (
                <Button size="sm" onClick={() => startNewTerm(detailId === "unassigned" ? null : detailProgram)}>
                  <Plus className="h-4 w-4" /> Neuer Zeitraum
                </Button>
              )}
            </div>
            {renderTermTable(detailId === "unassigned" ? null : detailId)}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailId(null)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={progOpen} onOpenChange={setProgOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingProg.id ? "Kursangebot bearbeiten" : "Neues Kursangebot"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name *</Label><Input value={editingProg.name || ""} onChange={e => setEditingProg(p => ({ ...p, name: e.target.value, slug: p.slug || slugify(e.target.value) }))} /></div>
              <div><Label>Slug (URL)</Label><Input value={editingProg.slug || ""} onChange={e => setEditingProg(p => ({ ...p, slug: e.target.value }))} /><Hint>Adresse der Detailseite: /kurse/{editingProg.slug || "…"} – nachträgliches Ändern verändert bestehende Links.</Hint></div>
            </div>
            <div><Label>Beschreibung</Label><Textarea rows={3} value={editingProg.description || ""} onChange={e => setEditingProg(p => ({ ...p, description: e.target.value }))} /><Hint>Erster Absatz = Kurztext in der Kursübersicht /kurse und Einleitung oben auf der Detailseite. Weitere Absätze (durch Leerzeile trennen) erscheinen nur auf der Detailseite.</Hint></div>
            <div><Label>Voraussetzungen</Label><Textarea rows={2} value={editingProg.requirements || ""} onChange={e => setEditingProg(p => ({ ...p, requirements: e.target.value }))} /><Hint>Kursübersicht: kurz unter „Voraussetzungen" bzw. bei geplanten Angeboten als „Rahmen". Detailseite: eigener Abschnitt. Jede Zeile wird zu einem Aufzählungspunkt.</Hint></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Zielgruppe</Label><Input value={editingProg.target_group || ""} onChange={e => setEditingProg(p => ({ ...p, target_group: e.target.value }))} /><Hint>Badge oben auf der Kurskarte und in der Infobox der Detailseite.</Hint></div>
              <div><Label>Altersangabe</Label><Input value={editingProg.age_range || ""} onChange={e => setEditingProg(p => ({ ...p, age_range: e.target.value }))} /><Hint>Blaue Zeile unter dem Kursnamen (Kursübersicht) und Infobox (Detailseite).</Hint></div>
              <div><Label>Mindestalter (Jahre)</Label><Input type="number" value={editingProg.min_age_years ?? ""} onChange={e => setEditingProg(p => ({ ...p, min_age_years: e.target.value === "" ? null : Number(e.target.value) }))} /><Hint>Nur Detailseite (Hinweis bei den Voraussetzungen) und Prüfung bei der Buchung.</Hint></div>
              <div><Label>Dauer</Label><Input value={editingProg.duration || ""} onChange={e => setEditingProg(p => ({ ...p, duration: e.target.value }))} /><Hint>Uhr-Zeile auf Kurskarte und Detailseite (z. B. „8 Termine · ca. 40 Minuten").</Hint></div>
            </div>
            <div><Label>Ort</Label><Input value={editingProg.location || ""} onChange={e => setEditingProg(p => ({ ...p, location: e.target.value }))} /><Hint>Ortszeile auf Kurskarte und Detailseite. Einzelne Zeiträume können unten einen abweichenden Ort haben.</Hint></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Preis Nicht-Mitglied (€)</Label><Input type="number" value={editingProg.price_non_member ?? ""} onChange={e => setEditingProg(p => ({ ...p, price_non_member: e.target.value === "" ? null : Number(e.target.value) }))} /><Hint>Preiszeile auf Kurskarte und Detailseite.</Hint></div>
              <div><Label>Preis Mitglied (€)</Label><Input type="number" value={editingProg.price_member ?? ""} onChange={e => setEditingProg(p => ({ ...p, price_member: e.target.value === "" ? null : Number(e.target.value) }))} /><Hint>Preiszeile auf Kurskarte und Detailseite.</Hint></div>
              <div><Label>Zahlungsziel (Tage)</Label><Input type="number" value={editingProg.payment_due_days ?? 14} onChange={e => setEditingProg(p => ({ ...p, payment_due_days: Number(e.target.value) }))} /><Hint>Nicht öffentlich sichtbar – wird in Buchungsbestätigung und Rechnungstext genutzt.</Hint></div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div><Label>Sortierung</Label><Input type="number" value={editingProg.sort_order ?? 0} onChange={e => setEditingProg(p => ({ ...p, sort_order: Number(e.target.value) }))} /><Hint>Reihenfolge der Karten in der Kursübersicht (kleine Zahl zuerst).</Hint></div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={editingProg.is_public ?? true} onCheckedChange={v => setEditingProg(p => ({ ...p, is_public: Boolean(v) }))} />
                Auf der Webseite anzeigen
                <span className="text-[11px] text-muted-foreground">(Karte in /kurse + Detailseite)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={editingProg.bookable ?? true} onCheckedChange={v => setEditingProg(p => ({ ...p, bookable: Boolean(v) }))} />
                Online buchbar
                <span className="text-[11px] text-muted-foreground">(aus: „Geplant – noch nicht buchbar")</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProgOpen(false)}>Abbrechen</Button>
            <Button onClick={saveProgram}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing.id ? "Kurs bearbeiten" : "Neuer Kurs"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name *</Label><Input value={editing.name || ""} onChange={e => setEditing(p => ({ ...p, name: e.target.value, slug: p.slug || slugify(e.target.value) }))} /></div>
              <div><Label>Slug</Label><Input value={editing.slug || ""} onChange={e => setEditing(p => ({ ...p, slug: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Kursangebot (für die Webseite)</Label>
              <Select value={editing.program_id || "none"} onValueChange={v => setEditing(p => ({ ...p, program_id: v === "none" ? null : v }))}>
                <SelectTrigger><SelectValue placeholder="Kein Kursangebot" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Kursangebot (nur intern)</SelectItem>
                  {programs.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Zugeordnete Zeiträume erscheinen auf der Webseite unter dem Kursangebot und können dort gebucht werden.</p>
            </div>

            <div><Label>Beschreibung</Label><Textarea rows={3} value={editing.description || ""} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Zielgruppe</Label><Input value={editing.target_group || ""} onChange={e => setEditing(p => ({ ...p, target_group: e.target.value }))} /></div>
              <div><Label>Altersgruppe</Label><Input value={editing.age_range || ""} onChange={e => setEditing(p => ({ ...p, age_range: e.target.value }))} /></div>
              <div><Label>Dauer</Label><Input value={editing.duration || ""} onChange={e => setEditing(p => ({ ...p, duration: e.target.value }))} placeholder="z.B. 10 Wochen" /></div>
              <div><Label>Ort</Label><Input value={editing.location || ""} onChange={e => setEditing(p => ({ ...p, location: e.target.value }))} /></div>
              <div><Label>Start</Label><Input type="date" value={editing.starts_on || ""} onChange={e => setEditing(p => ({ ...p, starts_on: e.target.value || null }))} /></div>
              <div><Label>Ende</Label><Input type="date" value={editing.ends_on || ""} onChange={e => setEditing(p => ({ ...p, ends_on: e.target.value || null }))} /></div>
              <div><Label>Max. Plätze</Label><Input type="number" value={editing.max_participants ?? ""} onChange={e => setEditing(p => ({ ...p, max_participants: e.target.value ? Number(e.target.value) : null }))} /></div>
              <div><Label>Anzahl der Einheiten</Label><Input type="number" value={editing.unit_count ?? ""} onChange={e => setEditing(p => ({ ...p, unit_count: e.target.value ? Number(e.target.value) : null }))} placeholder="z.B. 12" /></div>
              <div>
                <Label>Status</Label>
                <Select value={editing.status} onValueChange={(v: any) => setEditing(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Zeitplan</Label><Input value={editing.schedule || ""} onChange={e => setEditing(p => ({ ...p, schedule: e.target.value }))} placeholder="z.B. Mo & Mi 17:00–18:00" /></div>
            <div className="grid grid-cols-3 gap-3 border-t pt-3">
              <div>
                <Label>Preis Mitglied (€)</Label>
                <Input type="number" step="0.01" value={editing.price_member ?? ""} onChange={e => setEditing(p => ({ ...p, price_member: e.target.value ? Number(e.target.value) : null }))} placeholder="150" />
              </div>
              <div>
                <Label>Preis Nicht-Mitglied (€)</Label>
                <Input type="number" step="0.01" value={editing.price_non_member ?? ""} onChange={e => setEditing(p => ({ ...p, price_non_member: e.target.value ? Number(e.target.value) : null }))} placeholder="200" />
              </div>
              <div>
                <Label>Zahlungsfrist (Tage)</Label>
                <Input type="number" value={editing.payment_due_days ?? 14} onChange={e => setEditing(p => ({ ...p, payment_due_days: e.target.value ? Number(e.target.value) : 14 }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={editing.is_public ?? true} onCheckedChange={v => setEditing(p => ({ ...p, is_public: !!v }))} /> Öffentlich sichtbar</label>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={partOpen} onOpenChange={setPartOpen}>
        <DialogContent className="w-[95vw] max-w-[1400px] sm:max-w-[1400px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Teilnehmer: {partCourse?.name}</DialogTitle>
          </DialogHeader>
          {partCourse && (() => {
            const cnt = counts[partCourse.id] || { confirmed: 0, waiting: 0 };
            const max = partCourse.max_participants;
            const free = max != null ? Math.max(0, max - cnt.confirmed) : null;
            return (
              <div className="text-sm text-muted-foreground mb-2">
                Bestätigt: <span className="font-semibold text-foreground">{cnt.confirmed}</span>
                {max != null && <> von {max} · Frei: <span className="font-semibold text-foreground">{free}</span></>}
                {cnt.waiting > 0 && <> · Warteliste: <span className="font-semibold text-foreground">{cnt.waiting}</span></>}
              </div>
            );
          })()}
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Geburtsdatum</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mitglied</TableHead>
                  <TableHead>Ergebnis</TableHead>
                  {canManage && <TableHead>Bezahlt</TableHead>}
                  <TableHead>Notiz</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.length === 0 && <TableRow><TableCell colSpan={canManage ? 9 : 8} className="text-center py-6 text-muted-foreground text-xs">Noch keine Teilnehmer.</TableCell></TableRow>}

                {participants.map(p => {
                  const age = ageAt(p.date_of_birth, partCourse?.starts_on);
                  return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">
                      {p.request_id ? (
                        <button
                          type="button"
                          onClick={() => openRequest(p.request_id!)}
                          className="text-left text-primary underline underline-offset-2 hover:opacity-80"
                          title="Kursanfrage anzeigen"
                        >
                          {p.participant_name || "—"}
                        </button>
                      ) : (
                        <span title="Manuell angelegt (keine Kursanfrage)">{p.participant_name || "—"}</span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs">
                      {p.date_of_birth ? (
                        <>
                          {fmtDate(p.date_of_birth)}
                          {age != null && (
                            <div className="text-muted-foreground">{age} J. {partCourse?.starts_on ? "bei Kursbeginn" : "(heute)"}</div>
                          )}
                        </>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{p.participant_email || "—"}{p.participant_phone && <><br />{p.participant_phone}</>}</TableCell>
                    <TableCell>
                      <Select value={p.status} onValueChange={(v: any) => updatePartStatus(p, v)}>
                        <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{ENROLL_STATUS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.is_member === true && (
                        <Badge className={p.member_confirmed ? "bg-green-600 hover:bg-green-700" : ""} variant={p.member_confirmed ? "default" : "outline"}>
                          Mitglied{p.member_confirmed ? " ✓" : ""}
                        </Badge>
                      )}
                      {p.is_member === false && <Badge variant="secondary">Nicht-Mitglied</Badge>}
                      {p.is_member == null && <span className="text-muted-foreground">offen</span>}
                      {canManage && p.price_amount != null && <div className="text-muted-foreground mt-1">{Number(p.price_amount).toFixed(2)} €</div>}
                    </TableCell>

                    <TableCell className="text-xs">
                      {p.goal_reached === true && <Badge className="bg-green-600 hover:bg-green-700"><Award className="h-3 w-3 mr-1" />Ziel erreicht</Badge>}
                      {p.goal_reached === false && <Badge variant="secondary">Ziel offen</Badge>}
                      {p.badge && <div className="mt-1">{p.badge}</div>}
                      {p.achievement && <div className="text-muted-foreground mt-0.5 max-w-[180px] truncate" title={p.achievement}>{p.achievement}</div>}
                      {p.goal_reached == null && !p.badge && !p.achievement && "—"}
                    </TableCell>
                    {canManage && (() => {
                      const st = paymentState({
                        paid: p.paid,
                        paidAt: p.paid_at,
                        bookedAt: p.created_at,
                        startsOn: partCourse?.starts_on,
                        paymentDueDays: partCourse?.payment_due_days,
                      });
                      return (
                        <TableCell className="text-xs">
                          <label className="flex items-start gap-2 cursor-pointer">
                            <Checkbox className="mt-0.5" checked={p.paid} onCheckedChange={v => togglePaid(p, !!v)} />
                            <span>
                              <Badge variant="outline" className={st.className}>{st.label}</Badge>
                              <span className="block text-muted-foreground mt-0.5">{st.detail}</span>
                            </span>
                          </label>
                        </TableCell>
                      );
                    })()}
                    <TableCell className="text-xs max-w-[200px] truncate">{p.notes || "—"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => setEditPart(p)}><Pencil className="h-4 w-4" /></Button>
                      {canManage && <Button variant="ghost" size="sm" onClick={() => removePart(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          </div>

          {canManage && <div className="border-t pt-4 mt-4 space-y-3">
            <div className="font-semibold text-sm">Teilnehmer hinzufügen</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name *</Label><Input value={newPart.name} onChange={e => setNewPart(p => ({ ...p, name: e.target.value }))} /></div>
              <div>
                <Label>Geburtsdatum</Label>
                <Input type="date" value={newPart.date_of_birth} onChange={e => setNewPart(p => ({ ...p, date_of_birth: e.target.value }))} />
                {newPart.date_of_birth && (() => {
                  const a = ageAt(newPart.date_of_birth, partCourse?.starts_on);
                  return a != null ? <div className="text-xs text-muted-foreground mt-1">{a} Jahre {partCourse?.starts_on ? "bei Kursbeginn" : "(heute)"}</div> : null;
                })()}
              </div>
              <div><Label>E-Mail</Label><Input type="email" value={newPart.email} onChange={e => setNewPart(p => ({ ...p, email: e.target.value }))} /></div>
              <div><Label>Telefon</Label><Input value={newPart.phone} onChange={e => setNewPart(p => ({ ...p, phone: e.target.value }))} /></div>
              <div>
                <Label>Status</Label>
                <Select value={newPart.status} onValueChange={(v: any) => setNewPart(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Bestätigt</SelectItem>
                    <SelectItem value="waiting">Warteliste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div><Label>Notiz</Label><Textarea rows={2} value={newPart.notes} onChange={e => setNewPart(p => ({ ...p, notes: e.target.value }))} /></div>
            <Button onClick={addParticipant}><Plus className="h-4 w-4" /> Hinzufügen</Button>
          </div>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPartOpen(false)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reqOpen} onOpenChange={setReqOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Kursanfrage</DialogTitle></DialogHeader>
          {reqLoading && <div className="text-sm text-muted-foreground">Wird geladen …</div>}
          {!reqLoading && !reqRow && <div className="text-sm text-muted-foreground">Keine Anfrage gefunden.</div>}
          {reqRow && (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{REQUEST_STATUS_LABEL[reqRow.status] || reqRow.status}</Badge>
                <span className="text-muted-foreground">Eingegangen: {formatDateTimeBerlin(reqRow.created_at)}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><div className="text-xs text-muted-foreground">Eltern / Kontakt</div><div className="font-medium">{reqRow.parent_name}</div></div>
                <div><div className="text-xs text-muted-foreground">E-Mail</div><div className="font-medium break-all">{reqRow.parent_email}</div></div>
                <div><div className="text-xs text-muted-foreground">Telefon</div><div className="font-medium">{reqRow.parent_phone || "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Kontaktaufnahme erlaubt</div><div className="font-medium">{reqRow.contact_permission ? "Ja" : "Nein"}</div></div>
                <div><div className="text-xs text-muted-foreground">Kind</div><div className="font-medium">{reqRow.child_name || "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Geburtsdatum</div><div className="font-medium">{reqRow.child_dob ? fmtDate(reqRow.child_dob) : "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Gewünschter Kurs</div><div className="font-medium">{reqRow.desired_course || "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Schwimmniveau</div><div className="font-medium">{reqRow.swimming_level || "—"}</div></div>
              </div>
              {reqRow.health_info && (
                <div><div className="text-xs text-muted-foreground">Gesundheitshinweise</div><div className="whitespace-pre-wrap">{reqRow.health_info}</div></div>
              )}
              {reqRow.message && (
                <div><div className="text-xs text-muted-foreground">Nachricht</div><div className="whitespace-pre-wrap">{reqRow.message}</div></div>
              )}
              {reqRow.admin_notes && (
                <div><div className="text-xs text-muted-foreground">Interne Notizen</div><div className="whitespace-pre-wrap">{reqRow.admin_notes}</div></div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReqOpen(false)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      <Dialog open={!!editPart} onOpenChange={v => !v && setEditPart(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Teilnehmer bearbeiten</DialogTitle></DialogHeader>
          {editPart && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name *</Label><Input value={editPart.participant_name || ""} onChange={e => setEditPart(p => p && { ...p, participant_name: e.target.value })} /></div>
                <div>
                  <Label>Geburtsdatum</Label>
                  <Input type="date" value={editPart.date_of_birth || ""} onChange={e => setEditPart(p => p && { ...p, date_of_birth: e.target.value })} />
                  {editPart.date_of_birth && (() => {
                    const a = ageAt(editPart.date_of_birth, partCourse?.starts_on);
                    return a != null ? <div className="text-xs text-muted-foreground mt-1">{a} Jahre {partCourse?.starts_on ? "bei Kursbeginn" : "(heute)"}</div> : null;
                  })()}
                </div>
                <div><Label>E-Mail</Label><Input type="email" value={editPart.participant_email || ""} onChange={e => setEditPart(p => p && { ...p, participant_email: e.target.value })} /></div>
                <div><Label>Telefon</Label><Input value={editPart.participant_phone || ""} onChange={e => setEditPart(p => p && { ...p, participant_phone: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={editPart.status} onValueChange={(v: any) => setEditPart(p => p && { ...p, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ENROLL_STATUS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Notiz</Label><Textarea rows={2} value={editPart.notes || ""} onChange={e => setEditPart(p => p && { ...p, notes: e.target.value })} /></div>

              {canManage && <div className="border-t pt-3 mt-2">
                <div className="font-semibold text-sm mb-2">Mitgliedschaft & Preis</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Mitglied?</Label>
                    <Select
                      value={editPart.is_member == null ? "unset" : editPart.is_member ? "yes" : "no"}
                      onValueChange={(v) => setEditPart(p => p && { ...p, is_member: v === "unset" ? null : v === "yes" })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unset">— Unklar —</SelectItem>
                        <SelectItem value="yes">Ja</SelectItem>
                        <SelectItem value="no">Nein</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Kursgebühr (€)</Label>
                    <Input type="number" step="0.01" value={editPart.price_amount ?? ""} onChange={e => setEditPart(p => p && { ...p, price_amount: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={editPart.member_confirmed} onCheckedChange={v => setEditPart(p => p && { ...p, member_confirmed: !!v })} />
                      Mitgliedschaft bestätigt (Buchhaltung)
                    </label>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Elternkonto-Verknüpfung: {editPart.parent_user_id ? <span className="font-mono">{editPart.parent_user_id}</span> : "noch nicht verknüpft (wird automatisch bei Registrierung der Eltern-E-Mail gesetzt)"}
                </div>
              </div>}


              <div className="border-t pt-3 mt-2">
                <div className="font-semibold text-sm mb-2 flex items-center gap-2"><Award className="h-4 w-4" /> Kursergebnis</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Kursziel erreicht?</Label>
                    <Select
                      value={editPart.goal_reached == null ? "unset" : editPart.goal_reached ? "yes" : "no"}
                      onValueChange={(v) => setEditPart(p => p && { ...p, goal_reached: v === "unset" ? null : v === "yes" })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unset">— Offen —</SelectItem>
                        <SelectItem value="yes">Ja, erreicht</SelectItem>
                        <SelectItem value="no">Nein, nicht erreicht</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Abzeichen</Label><Input placeholder="z.B. Seepferdchen, Bronze" value={editPart.badge || ""} onChange={e => setEditPart(p => p && { ...p, badge: e.target.value })} /></div>
                </div>
                <div className="mt-3"><Label>Geschafft / Anmerkungen zum Ergebnis</Label><Textarea rows={3} placeholder="z.B. 25m geschwommen, Sprung vom Beckenrand …" value={editPart.achievement || ""} onChange={e => setEditPart(p => p && { ...p, achievement: e.target.value })} /></div>
              </div>

              {canManage && <div className="border-t pt-3 mt-2">
                <div className="font-semibold text-sm mb-2 flex items-center gap-2"><Euro className="h-4 w-4" /> Zahlung (Buchhaltung)</div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={editPart.paid} onCheckedChange={v => setEditPart(p => p && { ...p, paid: !!v, paid_at: v ? (p.paid_at || new Date().toISOString()) : null })} />
                  Kursgebühr bezahlt
                </label>
                {editPart.paid && editPart.paid_at && (
                  <div className="text-xs text-muted-foreground mt-1">Bestätigt am {fmtDate(editPart.paid_at)}</div>
                )}
                <div className="mt-3"><Label>Zahlungsnotiz</Label><Textarea rows={2} placeholder="z.B. Überweisung, Bar, Rechnungsnr. …" value={editPart.payment_note || ""} onChange={e => setEditPart(p => p && { ...p, payment_note: e.target.value })} /></div>
              </div>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPart(null)}>Abbrechen</Button>
            <Button onClick={savePart}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sessOpen} onOpenChange={setSessOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Kurstermine: {sessCourse?.name}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Bis zu 10 Termine. Diese werden auf der Excel-Kursliste als Spaltenüberschriften ausgegeben. Trainer melden ihre Verfügbarkeit unter „Verfügbarkeit“.</p>
          <div className="space-y-3">
            {sessions.length === 0 && <div className="text-sm text-muted-foreground">Noch keine Termine.</div>}
            {sessions.map(s => {
              const nameOf = (id: string) => trainers.find(t => t.id === id)?.name || "Unbekannt";
              const yes = sessAvail.filter(a => a.session_id === s.id && a.available);
              const no = sessAvail.filter(a => a.session_id === s.id && !a.available);
              const assignedIds = sessAssign.filter(a => a.session_id === s.id).map(a => a.trainer_id);
              const declined = assignedIds.filter(id => no.some(n => n.trainer_id === id));
              return (
                <div key={s.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-sm text-muted-foreground">{s.session_index}.</span>
                    <Input type="date" value={s.session_date} onChange={e => updateSessionDate(s.id, e.target.value)} />
                    <Button variant="ghost" size="sm" onClick={() => removeSession(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-10 text-xs">
                    {yes.map(a => <Badge key={a.trainer_id} className="border-transparent bg-green-600 text-white">{nameOf(a.trainer_id)}</Badge>)}
                    {no.map(a => <Badge key={a.trainer_id} className="border-transparent bg-red-600 text-white">{nameOf(a.trainer_id)}</Badge>)}
                    {yes.length === 0 && no.length === 0 && <span className="text-muted-foreground">Noch keine Rückmeldungen</span>}
                  </div>
                  <div className="space-y-1 pl-10">
                    <Label className="text-xs text-muted-foreground">Eingeteilt (Mehrfachauswahl)</Label>
                    <div className="flex flex-wrap gap-2">
                      {trainers.length === 0 && <span className="text-xs text-muted-foreground">Keine Trainer gefunden</span>}
                      {trainers
                        .slice()
                        .sort((a, b) => {
                          const rank = (id: string) => (yes.some(y => y.trainer_id === id) ? 0 : no.some(n => n.trainer_id === id) ? 2 : 1);
                          return rank(a.id) - rank(b.id) || a.name.localeCompare(b.name, "de");
                        })
                        .map(t => {
                          const on = assignedIds.includes(t.id);
                          return (
                            <Button
                              key={t.id}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => toggleAssignment(s.id, t.id, !on)}
                              className={on ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90" : ""}
                            >
                              {t.name}
                              <span className="ml-1 text-[10px] opacity-80">
                                {yes.some(y => y.trainer_id === t.id) ? "kann" : no.some(n => n.trainer_id === t.id) ? "kann nicht" : ""}
                              </span>
                            </Button>
                          );
                        })}
                    </div>
                    {assignedIds.length === 0 && <span className="text-xs text-orange-600">Noch niemand eingeteilt</span>}
                    {declined.length > 0 && (
                      <span className="text-xs text-red-600">Abgesagt, aber eingeteilt: {declined.map(nameOf).join(", ")}</span>
                    )}
                  </div>
                </div>
              );

            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessOpen(false)}>Schließen</Button>
            <Button onClick={addSession} disabled={sessions.length >= 10}><Plus className="h-4 w-4" /> Termin hinzufügen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

