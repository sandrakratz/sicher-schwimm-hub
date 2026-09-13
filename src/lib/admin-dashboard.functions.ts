import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminTask = {
  key: string;
  label: string;
  count: number;
  /** Zielseite im Adminbereich */
  to: string;
  tone: "urgent" | "attention" | "info";
  hint?: string;
};

function berlinToday(): string {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }))
    .toISOString()
    .slice(0, 10);
}

/**
 * Arbeitsliste für die Admin-Startseite: offene Aufgaben statt reiner Zahlen.
 */
export const getAdminTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ tasks: AdminTask[] }> => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!isStaff) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = berlinToday();
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();
    const in14d = new Date(now.getTime() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const [overdue, offers, memberships, messages, requests, sessions, assignments] = await Promise.all([
      supabaseAdmin
        .from("course_participants")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed")
        .eq("paid", false)
        .not("payment_due_date", "is", null)
        .lt("payment_due_date", today),
      supabaseAdmin
        .from("waitlist_entries")
        .select("id", { count: "exact", head: true })
        .eq("status", "offered")
        .not("offer_expires_at", "is", null)
        .lt("offer_expires_at", in48h),
      supabaseAdmin
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseAdmin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("status", "new"),
      supabaseAdmin
        .from("course_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "new"),
      supabaseAdmin
        .from("course_sessions")
        .select("id,assigned_trainer_id")
        .gte("session_date", today)
        .lte("session_date", in14d),
      supabaseAdmin.from("course_session_assignments").select("session_id"),
    ]);

    const assigned = new Set((assignments.data ?? []).map((a) => a.session_id as string));
    const unstaffed = (sessions.data ?? []).filter(
      (s) => !s.assigned_trainer_id && !assigned.has(s.id as string),
    ).length;

    const tasks: AdminTask[] = [
      {
        key: "overdue",
        label: "Zahlungen überfällig",
        count: overdue.count ?? 0,
        to: "/admin/kurse",
        tone: "urgent",
        hint: "Zahlungsfrist ist abgelaufen",
      },
      {
        key: "offers",
        label: "Wartelisten-Angebote laufen bald ab",
        count: offers.count ?? 0,
        to: "/admin/warteliste",
        tone: "urgent",
        hint: "in den nächsten 48 Stunden",
      },
      {
        key: "memberships",
        label: "Mitgliedsanträge offen",
        count: memberships.count ?? 0,
        to: "/admin/mitgliedschaften",
        tone: "attention",
      },
      {
        key: "requests",
        label: "Neue Kursanfragen",
        count: requests.count ?? 0,
        to: "/admin/warteliste",
        tone: "attention",
      },
      {
        key: "messages",
        label: "Unbeantwortete Nachrichten",
        count: messages.count ?? 0,
        to: "/admin/nachrichten",
        tone: "attention",
      },
      {
        key: "unstaffed",
        label: "Termine ohne Trainer:in",
        count: unstaffed,
        to: "/admin/kalender",
        tone: "info",
        hint: "in den nächsten 14 Tagen",
      },
    ];

    return { tasks };
  });
