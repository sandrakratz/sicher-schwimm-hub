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

    // „Anfrageliste: zu prüfen“ = offene Rückfragen („Warteliste behalten?“) + Familien, bei denen
    // der Sperrvorschlag (ab 3 Absagen gesamt) offen ist. Gleiche Regel wie in listWaitlist.
    const { data: declinedRows } = await supabaseAdmin
      .from("waitlist_entries")
      .select("parent_email,child_name,child_dob,status,decline_count,block_review_dismissed_at");
    const { data: activeBlocks } = await supabaseAdmin
      .from("booking_blocklist")
      .select("email_norm,child_name_norm,child_dob")
      .eq("active", true);
    const norm = (v: string | null | undefined) =>
      (v ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    const rows = declinedRows ?? [];
    const followups = rows.filter((r) => ["declined", "expired"].includes(r.status)).length;
    const byEmail = new Map<string, number>();
    const byChild = new Map<string, number>();
    const dismissedEmail = new Set<string>();
    const dismissedChild = new Set<string>();
    const ck = (r: { child_name: string | null; child_dob: string | null }) =>
      `${norm(r.child_name)}|${r.child_dob ?? ""}`;
    for (const r of rows) {
      const n = Number(r.decline_count ?? 0);
      const em = norm(r.parent_email);
      if (em) byEmail.set(em, (byEmail.get(em) ?? 0) + n);
      byChild.set(ck(r), (byChild.get(ck(r)) ?? 0) + n);
      if (r.block_review_dismissed_at) {
        if (em) dismissedEmail.add(em);
        dismissedChild.add(ck(r));
      }
    }
    const suggestedFamilies = new Set<string>();
    for (const r of rows) {
      if (Number(r.decline_count ?? 0) < 1) continue;
      const em = norm(r.parent_email);
      const total = Math.max(em ? (byEmail.get(em) ?? 0) : 0, byChild.get(ck(r)) ?? 0);
      const blocked = (activeBlocks ?? []).some(
        (b) =>
          (b.email_norm && b.email_norm === em) ||
          (b.child_name_norm &&
            b.child_name_norm === norm(r.child_name) &&
            (!b.child_dob || b.child_dob === r.child_dob)),
      );
      if (
        total >= 3 &&
        !blocked &&
        !(em && dismissedEmail.has(em)) &&
        !dismissedChild.has(ck(r))
      )
        suggestedFamilies.add(em || ck(r));
    }

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
        key: "waitlist-review",
        label: "Anfrageliste: zu prüfen",
        count: followups + suggestedFamilies.size,
        to: "/admin/warteliste",
        tone: "attention",
        hint: `${followups} offene Rückfrage(n), ${suggestedFamilies.size} Sperrvorschlag/-vorschläge`,
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
