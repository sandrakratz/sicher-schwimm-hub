// News-Hinweis per E-Mail an Mitglieder: reine Hilfsfunktionen (ohne Datenbank).

const SITE = "https://sicher-schwimmen.com";

/** Nur öffentliche und Mitglieder-Beiträge dürfen per Mail an Mitglieder gehen. */
export function canNotify(n: { published: boolean; visibility: string }): boolean {
  return n.published && (n.visibility === "public" || n.visibility === "members");
}

export function newsLink(visibility: string): string {
  return visibility === "members" ? `${SITE}/portal/news` : `${SITE}/news`;
}

/** Vorschau-Text: Kurzbeschreibung, sonst Anfang des Inhalts ohne HTML/Markdown, gekürzt am Wortende. */
export function plainPreview(
  excerpt: string | null | undefined,
  content: string | null | undefined,
  max = 320,
): string {
  const source = (excerpt && excerpt.trim()) || content || "";
  const text = source
    .replace(/<[^>]*>/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_`>~]+/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()} …`;
}

export type MemberMailRow = {
  status: string;
  email: string | null;
  guardian_email: string | null;
};

const normEmail = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** Aktive Mitgliedschaften: Antrags-E-Mail und E-Mail der Erziehungsberechtigten, ohne Doppelte. */
export function recipientEmails(rows: MemberMailRow[]): string[] {
  const set = new Set<string>();
  for (const m of rows) {
    if (m.status !== "active") continue;
    for (const raw of [m.email, m.guardian_email]) {
      const e = normEmail(raw);
      if (e && looksLikeEmail(e)) set.add(e);
    }
  }
  return [...set].sort();
}

/** Tageslimit des Mail-Anbieters (kostenloser Tarif) mit etwas Reserve für andere Mails. */
export const DAILY_MAIL_BUDGET = 90;
/** So viele Mails je Serveraufruf (Cloudflare begrenzt die Zahl der Anfragen je Aufruf). */
export const BATCH_SIZE = 8;
