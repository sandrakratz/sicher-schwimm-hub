import {
  LayoutDashboard,
  User,
  Calendar,
  FileText,
  Newspaper,
  Mail,
  BookOpen,
  ClipboardCheck,
  Shield,
  Users,
  CalendarCheck,
  Send,
  Euro,
  Waves,
  Inbox,
} from "lucide-react";

export type Role = "admin" | "board" | "trainer" | "member" | "parent";

export type AppNavItem = {
  to:
    | "/portal"
    | "/portal/profil"
    | "/portal/kurse"
    | "/portal/familienschwimmen"
    | "/portal/news"
    | "/portal/events"
    | "/portal/dokumente"
    | "/portal/kontakt"
    | "/portal/postfach"
    | "/trainer"
    | "/trainer/verfuegbarkeit"
    | "/trainer/kurse"
    | "/trainer/abnahme"
    | "/trainer/mitglieder"
    | "/admin"
    | "/admin/kalender"
    | "/admin/dienstplan"
    | "/admin/familienschwimmen"
    | "/admin/qualifikationen"
    | "/admin/kursplanung"
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
    | "/admin/erwachsenenkurs"
    | "/admin/zustaendigkeiten"
    | "/admin/archiv"
    | "/admin/folgekurse"
    | "/admin/uebungsleitergelder"
    | "/admin/news"
    | "/admin/dokumente"
    | "/admin/events"
    | "/admin/nachrichten"
    | "/admin/mitgliedernachricht"
    | "/admin/emails"
    | "/admin/versandstatus"
    | "/admin/widerrufe"
    | "/admin/statistik"
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
  { to: "/portal/familienschwimmen", icon: Waves, label: "Mitgliederschwimmen" },
  { to: "/portal/postfach", icon: Inbox, label: "Postfach" },
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
    to: "/trainer/abnahme",
    icon: ClipboardCheck,
    label: "Abzeichen abnehmen",
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
 * Aufbau nach Prototyp A: Eingang (alles, was zu tun ist) → Kurse → Familien → Trainer → Geld → Versand → Verein.
 * `also` = weitere Seiten, die zum Bereich gehören, aber keinen eigenen Reiter haben.
 */
export const adminSections: {
  label: string;
  tabs: { to: AppNavItem["to"]; label: string }[];
  also?: string[];
}[] = [
  {
    label: "Kurse",
    tabs: [
      { to: "/admin/kurse", label: "Kurse & Teilnehmer" },
      { to: "/admin/folgekurse", label: "Folgekurse" },
      { to: "/admin/kursplanung", label: "Kursplanung" },
      { to: "/admin/erwachsenenkurs", label: "Erwachsenenkurs" },
      { to: "/admin/familienschwimmen", label: "Mitgliederschwimmen" },
    ],
  },
  {
    label: "Familien",
    tabs: [
      { to: "/admin/suche", label: "Suche" },
      { to: "/admin/warteliste", label: "Anfrageliste" },
      { to: "/admin/mitgliedschaften", label: "Mitgliedschaften" },
      { to: "/admin/sperrliste", label: "Sperrliste" },
      { to: "/admin/widerrufe", label: "Widerrufe" },
      { to: "/admin/archiv", label: "Frühere Kursanfragen" },
    ],
    also: ["/admin/familie"],
  },
  {
    label: "Trainer",
    tabs: [
      { to: "/admin/dienstplan", label: "Dienstplan" },
      { to: "/admin/kalender", label: "Einteilung" },
      { to: "/admin/qualifikationen", label: "Qualifikationen" },
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
    label: "Versand",
    tabs: [
      { to: "/admin/mitgliedernachricht", label: "Mitglieder anschreiben" },
      { to: "/admin/emails", label: "Gesendete E-Mails" },
      { to: "/admin/versandstatus", label: "Versandstatus" },
    ],
  },
  {
    label: "Verein",
    tabs: [
      { to: "/admin/news", label: "News" },
      { to: "/admin/events", label: "Events" },
      { to: "/admin/dokumente", label: "Dokumente" },
      { to: "/admin/benutzer", label: "Benutzer" },
      { to: "/admin/zustaendigkeiten", label: "Zuständigkeiten" },
      { to: "/admin/statistik", label: "Statistik" },
      { to: "/admin/audit", label: "Audit-Log" },
    ],
  },
];

/** Liegt `pathname` auf der Seite `base` oder darunter? (Nicht bloß gleicher Anfang: /admin/familie ≠ /admin/familienschwimmen) */
export function isUnder(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(base + "/");
}

export function findAdminSection(pathname: string) {
  return adminSections.find((s) =>
    [...s.tabs.map((t) => t.to as string), ...(s.also ?? [])].some((p) => isUnder(pathname, p)),
  );
}

const STAFF: Role[] = ["admin", "board"];

/** Ein Menüpunkt je Bereich; führt auf den ersten Reiter. */
const sectionNav = (label: string, icon: AppNavItem["icon"]) => {
  const section = adminSections.find((s) => s.label === label)!;
  return {
    to: section.tabs[0]!.to,
    icon,
    label: section.label,
    allow: STAFF,
    group: [...section.tabs.map((t) => t.to as string), ...(section.also ?? [])],
  };
};

export const adminNav: (AppNavItem & { group?: string[] })[] = [
  // Der Posteingang hat keinen eigenen Menüpunkt mehr: Nachrichten sind Aufgaben im Eingang.
  {
    to: "/admin",
    icon: Inbox,
    label: "Eingang",
    exact: true,
    allow: STAFF,
    group: ["/admin/nachrichten"],
  },
  sectionNav("Kurse", BookOpen),
  sectionNav("Familien", Users),
  sectionNav("Trainer", ClipboardCheck),
  sectionNav("Geld", Euro),
  sectionNav("Versand", Send),
  sectionNav("Verein", Newspaper),
];

export function visibleAdminNav(roles: Role[]) {
  return adminNav.filter((n) => (n.allow ?? []).some((r) => roles.includes(r)));
}
