import { formatDateBerlin } from "@/lib/format";

export type Item = {
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
  gdpr_consent: boolean;
  contact_permission: boolean;
  assigned_course_id?: string | null;
  admin_notes?: string | null;
  referred_sharky?: boolean | null;
  referred_sharky_at?: string | null;
};

export type CourseOpt = {
  id: string;
  name: string;
  status: string;
  max_participants: number | null;
  starts_on: string | null;
  price_member: number | null;
  price_non_member: number | null;
  program_id: string | null;
};

export type CourseInfo = {
  id: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
};

export type RequestStatus =
  "new" | "contacted" | "accepted" | "rejected" | "under_review" | "waiting_list";

/** Name und Zeitraum eines Kurses („01.03.2026 – 10.05.2026“), null wenn unbekannt. */
export type CourseLabel = (
  id: string | null | undefined,
) => { name: string; period: string } | null;

export function makeCourseLabel(all: CourseInfo[]): CourseLabel {
  const byId = new Map(all.map((c) => [c.id, c]));
  return (id) => {
    const c = id ? byId.get(id) : undefined;
    if (!c) return null;
    const period = [c.starts_on, c.ends_on]
      .filter(Boolean)
      .map((d) => formatDateBerlin(d))
      .join(" – ");
    return { name: c.name, period };
  };
}

/** Auf der Warteliste = Status „Warteliste“ und noch keinem Kurs zugewiesen. */
export const isWaitlisted = (r: Item) => r.status === "waiting_list" && !r.assigned_course_id;

export const COURSE_GROUPS: { key: string; label: string; match: (v: string) => boolean }[] = [
  { key: "wassergewoehnung", label: "Wassergewöhnung", match: (v) => v.includes("wassergew") },
  {
    key: "schwimmen-lernen",
    label: "Schwimmen lernen",
    match: (v) => v.includes("schwimmen lernen") || v.includes("schwimmenlernen"),
  },
  {
    key: "seepferdchen-vorbereitung",
    label: "Seepferdchen-Vorbereitung",
    match: (v) => v.includes("seepferdchen") && (v.includes("vorbereit") || v.includes("vorb")),
  },
  { key: "seepferdchen", label: "Seepferdchen", match: (v) => v.includes("seepferdchen") },
  { key: "bronze", label: "Bronze", match: (v) => v.includes("bronze") },
  { key: "silber", label: "Silber", match: (v) => v.includes("silber") },
  { key: "gold", label: "Gold", match: (v) => v.includes("gold") },
  { key: "sonstige", label: "Sonstige / Unbekannt", match: () => true },
];

export function groupKeyFor(desired: string | null): string {
  const v = (desired || "").toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
  if (!v) return "sonstige";
  for (const g of COURSE_GROUPS) if (g.match(v)) return g.key;
  return "sonstige";
}

export const STATUS_LABEL: Record<string, string> = {
  new: "Neu",
  under_review: "In Prüfung",
  contacted: "Kontaktiert",
  waiting_list: "Warteliste",
  accepted: "Akzeptiert",
  rejected: "Abgelehnt",
};

export const STATUS_CLASS: Record<string, string> = {
  new: "bg-green-600 hover:bg-green-700 text-white border-transparent",
  under_review: "bg-orange-500 hover:bg-orange-600 text-white border-transparent",
  contacted: "bg-blue-600 hover:bg-blue-700 text-white border-transparent",
  waiting_list: "bg-yellow-400 hover:bg-yellow-500 text-black border-transparent",
  accepted: "bg-teal-700 hover:bg-teal-800 text-white border-transparent",
  rejected: "bg-red-600 hover:bg-red-700 text-white border-transparent",
};
