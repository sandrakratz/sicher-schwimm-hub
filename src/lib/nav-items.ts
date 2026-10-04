import {
  LayoutDashboard,
  User,
  Calendar,
  FileText,
  Newspaper,
  Mail,
  BookOpen,
  Shield,
  ShieldBan,
  Users,
  ListChecks,
  CalendarCheck,
  Hourglass,
  MailOpen,
  Send,
  Activity,
  ScrollText,
  Euro,
  Search,
} from "lucide-react";

export type Role = "admin" | "board" | "trainer" | "member" | "parent";

export type AppNavItem = {
  to:
    | "/portal"
    | "/portal/profil"
    | "/portal/kurse"
    | "/portal/news"
    | "/portal/events"
    | "/portal/dokumente"
    | "/portal/kontakt"
    | "/trainer"
    | "/trainer/verfuegbarkeit"
    | "/trainer/kurse"
    | "/trainer/mitglieder"
    | "/admin"
    | "/admin/kalender"
    | "/admin/benutzer"
    | "/admin/mitglieder"
    | "/admin/mitgliedschaften"
    | "/admin/kurse"
    | "/admin/zahlungen"
    | "/admin/suche"
    | "/admin/verfuegbarkeit"
    | "/admin/anfragen"
    | "/admin/warteliste"
    | "/admin/sperrliste"
    | "/admin/uebungsleitergelder"
    | "/admin/news"
    | "/admin/dokumente"
    | "/admin/events"
    | "/admin/nachrichten"
    | "/admin/emails"
    | "/admin/versandstatus"
    | "/admin/widerrufe"
    | "/admin/audit";
  icon: typeof Shield;
  label: string;
  exact?: boolean;
  allow?: Role[];
};

/** Sichtbar für alle angemeldeten Nutzer */
export const portalNav: AppNavItem[] = [
  { to: "/portal", icon: LayoutDashboard, label: "Übersicht", exact: true },
  { to: "/portal/profil", icon: User, label: "Mein Profil" },
  { to: "/portal/kurse", icon: BookOpen, label: "Meine Kurse" },
  { to: "/portal/news", icon: Newspaper, label: "Vereinsnews" },
  { to: "/portal/events", icon: Calendar, label: "Termine" },
  { to: "/portal/dokumente", icon: FileText, label: "Dokumente" },
  { to: "/portal/kontakt", icon: Mail, label: "Verein kontaktieren" },
];

/** Eigener Bereich für Trainer:innen */
export const trainerNav: AppNavItem[] = [
  {
    to: "/trainer",
    icon: LayoutDashboard,
    label: "Trainerbereich",
    exact: true,
    allow: ["admin", "board", "trainer"],
  },
  {
    to: "/trainer/verfuegbarkeit",
    icon: CalendarCheck,
    label: "Meine Verfügbarkeit",
    allow: ["admin", "board", "trainer"],
  },
  {
    to: "/trainer/kurse",
    icon: BookOpen,
    label: "Meine Kurse",
    allow: ["admin", "board", "trainer"],
  },
  {
    to: "/trainer/mitglieder",
    icon: Users,
    label: "Vereinsmitglieder",
    allow: ["admin", "board", "trainer"],
  },
];

export function visibleTrainerNav(roles: Role[]): AppNavItem[] {
  return trainerNav.filter((n) => (n.allow ?? []).some((r) => roles.includes(r)));
}

/** Gebündelte Verwaltungsbereiche: ein Menüpunkt, oben Reiter */
export const adminSections: { label: string; tabs: { to: AppNavItem["to"]; label: string }[] }[] = [
  {
    label: "Mitglieder & Anträge",
    tabs: [
      { to: "/admin/benutzer", label: "Benutzer" },
      { to: "/admin/mitgliedschaften", label: "Mitgliedschaften" },
      { to: "/admin/widerrufe", label: "Widerrufe" },
      { to: "/admin/sperrliste", label: "Sperrliste" },
      { to: "/admin/uebungsleitergelder", label: "Übungsleitergelder" },
    ],
  },
  {
    label: "Kommunikation & E-Mails",
    tabs: [
      { to: "/admin/nachrichten", label: "Posteingang" },
      { to: "/admin/emails", label: "Gesendete E-Mails" },
      { to: "/admin/versandstatus", label: "Versandstatus" },
    ],
  },
  {
    label: "Inhalte & Verein",
    tabs: [
      { to: "/admin/news", label: "News" },
      { to: "/admin/events", label: "Events" },
      { to: "/admin/dokumente", label: "Dokumente" },
    ],
  },
];

export function findAdminSection(pathname: string) {
  return adminSections.find((s) => s.tabs.some((t) => pathname.startsWith(t.to)));
}

/** Nur mit passender Rolle sichtbar */
export const adminNav: (AppNavItem & { group?: string[] })[] = [
  { to: "/admin", icon: Shield, label: "Übersicht", exact: true, allow: ["admin", "board"] },
  { to: "/admin/suche", icon: Search, label: "Suche", allow: ["admin", "board"] },
  { to: "/admin/kurse", icon: BookOpen, label: "Kurse", allow: ["admin", "board"] },
  { to: "/admin/zahlungen", icon: Euro, label: "Offene Zahlungen", allow: ["admin", "board"] },
  { to: "/admin/warteliste", icon: Hourglass, label: "Warteliste", allow: ["admin", "board"] },
  { to: "/admin/kalender", icon: CalendarCheck, label: "Kurskalender", allow: ["admin", "board"] },
  {
    to: "/admin/benutzer",
    icon: Users,
    label: "Mitglieder & Anträge",
    allow: ["admin", "board"],
    group: adminSections[0].tabs.map((t) => t.to),
  },
  {
    to: "/admin/nachrichten",
    icon: MailOpen,
    label: "Kommunikation & E-Mails",
    allow: ["admin", "board"],
    group: adminSections[1].tabs.map((t) => t.to),
  },
  {
    to: "/admin/news",
    icon: Newspaper,
    label: "Inhalte & Verein",
    allow: ["admin", "board"],
    group: adminSections[2].tabs.map((t) => t.to),
  },
  { to: "/admin/audit", icon: ScrollText, label: "Audit-Log", allow: ["admin"] },
];

export function visibleAdminNav(roles: Role[]) {
  return adminNav.filter((n) => (n.allow ?? []).some((r) => roles.includes(r)));
}
