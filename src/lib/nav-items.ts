import { LayoutDashboard, User, Calendar, FileText, Newspaper, Mail, BookOpen, Shield, ShieldBan, Users, ListChecks, CalendarCheck, Hourglass, MailOpen, Send, Activity, ScrollText } from "lucide-react";

export type Role = "admin" | "board" | "trainer" | "member" | "parent";

export type AppNavItem = {
  to:
    | "/portal" | "/portal/profil" | "/portal/kurse" | "/portal/news" | "/portal/events" | "/portal/dokumente" | "/portal/kontakt"
    | "/admin" | "/admin/benutzer" | "/admin/mitglieder" | "/admin/mitgliedschaften" | "/admin/kurse" | "/admin/verfuegbarkeit" | "/admin/anfragen" | "/admin/warteliste" | "/admin/sperrliste" | "/admin/news" | "/admin/dokumente" | "/admin/events" | "/admin/nachrichten" | "/admin/emails" | "/admin/versandstatus" | "/admin/widerrufe" | "/admin/audit";
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

/** Nur mit passender Rolle sichtbar */
export const adminNav: AppNavItem[] = [
  { to: "/admin", icon: Shield, label: "Übersicht", exact: true, allow: ["admin", "board"] },
  { to: "/admin/benutzer", icon: Users, label: "Benutzer", allow: ["admin", "board", "trainer"] },
  { to: "/admin/mitglieder", icon: Users, label: "Vereinsmitglieder", allow: ["admin", "board", "trainer"] },
  { to: "/admin/mitgliedschaften", icon: ListChecks, label: "Mitgliedschaften", allow: ["admin", "board"] },
  { to: "/admin/kurse", icon: BookOpen, label: "Kurse", allow: ["admin", "board", "trainer"] },
  { to: "/admin/verfuegbarkeit", icon: CalendarCheck, label: "Verfügbarkeit", allow: ["admin", "board", "trainer"] },
  { to: "/admin/anfragen", icon: ListChecks, label: "Kursanfragen (Archiv)", allow: ["admin"] },
  { to: "/admin/warteliste", icon: Hourglass, label: "Warteliste", allow: ["admin", "board"] },
  { to: "/admin/sperrliste", icon: ShieldBan, label: "Sperrliste", allow: ["admin", "board"] },
  { to: "/admin/news", icon: Newspaper, label: "News", allow: ["admin", "board"] },
  { to: "/admin/dokumente", icon: FileText, label: "Dokumente", allow: ["admin", "board"] },
  { to: "/admin/events", icon: Calendar, label: "Events", allow: ["admin", "board"] },
  { to: "/admin/nachrichten", icon: MailOpen, label: "Nachrichten", allow: ["admin", "board"] },
  { to: "/admin/emails", icon: Send, label: "Gesendete E-Mails", allow: ["admin", "board"] },
  { to: "/admin/versandstatus", icon: Activity, label: "Versandstatus", allow: ["admin", "board"] },
  { to: "/admin/widerrufe", icon: FileText, label: "Widerrufe", allow: ["admin", "board"] },
  { to: "/admin/audit", icon: ScrollText, label: "Audit-Log", allow: ["admin"] },
];

export function visibleAdminNav(roles: Role[]): AppNavItem[] {
  return adminNav.filter(n => (n.allow ?? []).some(r => roles.includes(r)));
}
