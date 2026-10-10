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

/**
 * Gebündelte Verwaltungsbereiche: ein Menüpunkt, oben Reiter.
 * Gegliedert nach Arbeitsablauf: Heute → Anmeldungen → Kurse → Geld → Mitglieder → Kommunikation.
 */
export const adminSections: { label: string; tabs: { to: AppNavItem["to"]; label: string }[] }[] = [
  {
    label: "Anmeldungen",
    tabs: [
      { to: "/admin/warteliste", label: "Anfrageliste" },
      { to: "/admin/suche", label: "Gesamtsuche" },
      { to: "/admin/sperrliste", label: "Sperrliste" },
      { to: "/admin/widerrufe", label: "Widerrufe" },
    ],
  },
  {
    label: "Kurse",
    tabs: [
      { to: "/admin/kurse", label: "Kurse & Teilnehmer" },
      { to: "/admin/kalender", label: "Kurskalender" },
    ],
  },
  {
    label: "Geld",
    tabs: [
      { to: "/admin/zahlungen", label: "Offene Zahlungen" },
      { to: "/admin/uebungsleitergelder", label: "Übungsleitergelder" },
    ],
  },
  {
    label: "Mitglieder",
    tabs: [
      { to: "/admin/benutzer", label: "Benutzer" },
      { to: "/admin/mitgliedschaften", label: "Mitgliedschaften" },
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
const sectionNav = (index: number, icon: AppNavItem["icon"], allow: Role[]) => {
  const section = adminSections[index]!;
  return {
    to: section.tabs[0]!.to,
    icon,
    label: section.label,
    allow,
    group: section.tabs.map((t) => t.to),
  };
};

export const adminNav: (AppNavItem & { group?: string[] })[] = [
  { to: "/admin", icon: Shield, label: "Heute", exact: true, allow: ["admin", "board"] },
  sectionNav(0, Hourglass, ["admin", "board"]),
  sectionNav(1, BookOpen, ["admin", "board"]),
  sectionNav(2, Euro, ["admin", "board"]),
  sectionNav(3, Users, ["admin", "board"]),
  sectionNav(4, MailOpen, ["admin", "board"]),
  sectionNav(5, Newspaper, ["admin", "board"]),
  { to: "/admin/audit", icon: ScrollText, label: "Audit-Log", allow: ["admin", "board"] },
];

export function visibleAdminNav(roles: Role[]) {
  return adminNav.filter((n) => (n.allow ?? []).some((r) => roles.includes(r)));
}
