import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchAll, fetchIn } from "@/lib/fetch-all";

export type AdminTask = {
  key: string;
  label: string;
  count: number;
  /** Zielseite im Adminbereich */
  to: string;
  /** Optionaler Reiter der Zielseite (z. B. { tab: "archive" }) */
  search?: { tab: "archive" };
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

    // Termine der nächsten 14 Tage (nur nicht archivierte Kurse), dazu deren Zuordnungen – nicht die ganze Tabelle
    // (Supabase liefert pro Abfrage höchstens 1000 Zeilen, die Zahl wäre sonst irgendwann zu hoch).
    const sessions = await fetchAll<any>((f, t) =>
      supabaseAdmin
        .from("course_sessions")
        .select("id,assigned_trainer_id,courses!inner(archived_at,trainer_id,trainers_needed)")
        .is("courses.archived_at", null)
        .gte("session_date", today)
        .lte("session_date", in14d)
        .order("id")
        .range(f, t),
    );
    const assignments = await fetchIn<any>(
      sessions.map((s) => s.id as string),
      (chunk, f, t) =>
        supabaseAdmin
          .from("course_session_assignments")
          .select("session_id,trainer_id")
          .in("session_id", chunk)
          .order("id")
          .range(f, t),
    );

    const [overdue, offers, memberships, messages, requests] = await Promise.all([
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
    ]);

    const teamBySession = new Map<string, Set<string>>();
    assignments.forEach((a) => {
      const set = teamBySession.get(a.session_id as string) ?? new Set<string>();
      set.add(a.trainer_id as string);
      teamBySession.set(a.session_id as string, set);
    });
    // „Besetzt“ wie im Kurskalender: Dienstplan-Einträge, Termin-Trainer:in und Kurstrainer:in zählen zusammen
    // und müssen die beim Kurs hinterlegte Zahl benötigter Trainer:innen erreichen.
    const unstaffed = sessions.filter((s) => {
      const team = new Set(teamBySession.get(s.id as string) ?? []);
      if (s.assigned_trainer_id) team.add(s.assigned_trainer_id as string);
      if (s.courses?.trainer_id) team.add(s.courses.trainer_id as string);
      return team.size < ((s.courses?.trainers_needed as number | null) ?? 2);
    }).length;

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
        search: { tab: "archive" },
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
        label: "Termine nicht voll besetzt",
        count: unstaffed,
        to: "/admin/kalender",
        tone: "info",
        hint: "in den nächsten 14 Tagen",
      },
    ];

    return { tasks };
  });
