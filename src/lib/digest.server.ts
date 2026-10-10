// Server-only: tägliche Zusammenfassung „Das liegt heute bei dir“ je Vorstandsmitglied.
// Zählt offene Vorgänge, die der Person ausdrücklich oder per Standard-Zuständigkeit gehören.

import { fetchAll } from "@/lib/fetch-all";

const SITE = "https://sicher-schwimmen.com";

export type DigestLine = { label: string; count: number; detail?: string; url: string };
export type Digest = {
  userId: string;
  email: string;
  firstName: string;
  name: string;
  lines: DigestLine[];
};

const fullName = (p: { first_name: string | null; last_name: string | null }) =>
  [p.first_name, p.last_name].filter(Boolean).join(" ").trim();

function berlinToday(): string {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }))
    .toISOString()
    .slice(0, 10);
}

/** Zusammenfassungen für alle Vorstandsmitglieder mit E-Mail, die etwas zu tun haben und nicht abbestellt haben. */
export async function buildDigests(): Promise<Digest[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const today = berlinToday();
  const in48h = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

  const { data: roleRows } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "board"]);
  const ids = [...new Set((roleRows ?? []).map((r) => r.user_id))];
  if (!ids.length) return [];
  const [{ data: profs }, { data: optout }, { data: ruleRows }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id,first_name,last_name,email").in("id", ids),
    supabaseAdmin.from("digest_optout").select("user_id"),
    supabaseAdmin.from("assignment_rules").select("area,assignee"),
  ]);
  const off = new Set((optout ?? []).map((o) => o.user_id));
  const rule = (area: string) => ruleRows?.find((r) => r.area === area)?.assignee ?? null;

  const [payments, messages, waitlist] = await Promise.all([
    fetchAll<{ assigned_to: string | null; payment_due_date: string | null }>((f, t) =>
      supabaseAdmin
        .from("course_participants")
        .select("id,assigned_to,payment_due_date")
        .eq("status", "confirmed")
        .eq("paid", false)
        .order("id")
        .range(f, t),
    ),
    fetchAll<{ assigned_to: string | null; category: string; created_at: string }>((f, t) =>
      supabaseAdmin
        .from("messages")
        .select("id,assigned_to,category,created_at")
        .in("status", ["new", "read"])
        .order("id")
        .range(f, t),
    ),
    fetchAll<{
      assigned_to: string | null;
      status: string;
      offer_expires_at: string | null;
      follow_up_on: string | null;
    }>((f, t) =>
      supabaseAdmin
        .from("waitlist_entries")
        .select("id,assigned_to,status,offer_expires_at,follow_up_on")
        .in("status", ["waiting", "offered", "declined", "expired"])
        .order("id")
        .range(f, t),
    ),
  ]);

  const out: Digest[] = [];
  for (const p of profs ?? []) {
    if (!p.email || off.has(p.id)) continue;
    const name = fullName(p);
    if (!name) continue;
    const mine = <T extends { assigned_to: string | null }>(rows: T[], area: string) =>
      rows.filter((r) => (r.assigned_to || rule(area)) === name);
    const lines: DigestLine[] = [];

    const pay = mine(payments, "payments");
    if (pay.length) {
      const overdue = pay.filter((x) => x.payment_due_date && x.payment_due_date < today).length;
      lines.push({
        label: "Offene Zahlungen",
        count: pay.length,
        detail: overdue ? `davon ${overdue} überfällig` : undefined,
        url: `${SITE}/admin/zahlungen?zustaendig=ich`,
      });
    }

    const msg = mine(messages, "messages");
    if (msg.length) {
      const oldest = Math.max(
        ...msg.map((m) => Math.floor((Date.now() - new Date(m.created_at).getTime()) / 86400000)),
      );
      const complaints = msg.filter((m) => m.category === "complaint").length;
      lines.push({
        label: "Unbeantwortete Nachrichten",
        count: msg.length,
        detail:
          [
            complaints ? `${complaints} Beschwerde(n)` : "",
            oldest >= 1 ? `älteste seit ${oldest} Tag(en)` : "",
          ]
            .filter(Boolean)
            .join(", ") || undefined,
        url: `${SITE}/admin/nachrichten?zustaendig=ich`,
      });
    }

    const wl = mine(waitlist, "waitlist");
    const expiring = wl.filter(
      (w) => w.status === "offered" && w.offer_expires_at && w.offer_expires_at < in48h,
    ).length;
    const followups = wl.filter((w) => ["declined", "expired"].includes(w.status)).length;
    const due = wl.filter((w) => w.follow_up_on && w.follow_up_on <= today).length;
    if (expiring)
      lines.push({
        label: "Angebote laufen in 48 Std. ab",
        count: expiring,
        url: `${SITE}/admin/warteliste?zustaendig=ich`,
      });
    if (followups)
      lines.push({
        label: "Rückfragen „Warteliste behalten?“ offen",
        count: followups,
        url: `${SITE}/admin/warteliste?zustaendig=ich`,
      });
    if (due)
      lines.push({
        label: "Wiedervorlagen fällig",
        count: due,
        url: `${SITE}/admin/warteliste?zustaendig=ich`,
      });

    if (lines.length)
      out.push({
        userId: p.id,
        email: p.email,
        firstName: p.first_name ?? name,
        name,
        lines,
      });
  }
  return out;
}
