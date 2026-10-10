import type * as React from "react";
import { formatDateBerlin } from "@/lib/format";

// Gemeinsame Typen, Konstanten und kleine Hilfen der Kursverwaltung (aus routes/_authenticated/admin/kurse.tsx).

export type CourseCounts = {
  confirmed: number;
  waiting: number;
  unpaid: number;
  overdue: number;
  sessions: number;
  staffed: number;
  offered?: number;
};
export type Participant = {
  id: string;
  course_id: string;
  user_id: string | null;
  participant_name: string | null;
  participant_email: string | null;
  participant_phone: string | null;
  status: "confirmed" | "waiting" | "cancelled";
  notes: string | null;
  internal_notes?: string | null;
  date_of_birth: string | null;
  goal_reached: boolean | null;
  achievement: string | null;
  badge: string | null;
  /** Klötzchen am Schwimmgurt (6 = Anfänger … 0 = ohne Gurt), null = nicht erfasst */
  belt_blocks?: number | null;
  paid: boolean;
  paid_at: string | null;
  payment_note: string | null;
  is_member: boolean | null;
  member_confirmed: boolean;
  member_confirmed_at: string | null;
  paid_by?: string | null;
  member_confirmed_by?: string | null;
  price_amount: number | null;
  created_at?: string | null;
  payment_method?: string | null;
  payment_due_date?: string | null;
  parent_user_id: string | null;
  request_id: string | null;
};

export type CourseRequest = {
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

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  new: "Neu",
  under_review: "In Prüfung",
  contacted: "Kontaktiert",
  accepted: "Angenommen",
  waiting_list: "Warteliste",
  rejected: "Abgelehnt",
};

export const ENROLL_STATUS = [
  { value: "confirmed", label: "Bestätigt" },
  { value: "waiting", label: "Warteliste" },
  { value: "cancelled", label: "Abgesagt" },
];
export const ENROLL_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  ENROLL_STATUS.map((o) => [o.value, o.label]),
);

export function ageAt(
  dobStr: string | null | undefined,
  refStr: string | null | undefined,
): number | null {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  const ref = refStr ? new Date(refStr) : new Date();
  if (isNaN(dob.getTime()) || isNaN(ref.getTime())) return null;
  let age = ref.getFullYear() - dob.getFullYear();
  const m = ref.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age--;
  return age;
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(s: string | null | undefined) {
  return formatDateBerlin(s);
}

export type Course = {
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
  course_info: string | null;
  min_participants?: number | null;
  lanes?: number | null;
  trainers_needed?: number | null;
  start_tentative?: boolean;
  tentative_note?: string | null;
};

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{children}</p>;
}
export type ProgramRow = {
  id: string;
  name: string;
  slug: string;
  target_group: string | null;
  age_range: string | null;
  min_age_years: number | null;
  max_age_years?: number | null;
  min_swim_level?: number | null;
  weekday?: number | null;
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
  course_info: string | null;
};

export const STATUS_OPTIONS = [
  { value: "planned", label: "Geplant" },
  { value: "open", label: "Offen" },
  { value: "waiting_list", label: "Warteliste" },
  { value: "fully_booked", label: "Ausgebucht" },
  { value: "completed", label: "Abgeschlossen" },
];
export const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[äöüß]/g, (m) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" })[m] || m)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
