import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchAll, fetchIn } from "@/lib/fetch-all";
import { todayBerlinIso } from "@/lib/format";
import { assertStaff } from "@/lib/auth-guards.server";

export type AdminTask = {
  key: string;
  label: string;
  count: number;
  /** Zielseite im Adminbereich */
  to: string;
  /** Optionale Suchparameter der Zielseite (z. B. { ansicht: "offered" }) */
  search?: Record<string, string>;
  tone: "urgent" | "attention" | "info";
  hint?: string;
};

/**
 * Arbeitsliste für die Admin-Startseite: offene Aufgaben statt reiner Zahlen.
 */
export const getAdminTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ tasks: AdminTask[] }> => {
    await assertStaff(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = todayBerlinIso();
    const now = new Date();
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

    const [overdue, memberships, messages, requests, memberChecks, adultNew, familyNew] =
      await Promise.all([
        supabaseAdmin
          .from("course_participants")
          .select("id", { count: "exact", head: true })
          .eq("status", "confirmed")
          .eq("paid", false)
          .not("payment_due_date", "is", null)
          .lt("payment_due_date", today),
        supabaseAdmin
          .from("memberships")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabaseAdmin
          .from("messages")
          .select("id", { count: "exact", head: true })
          .in("status", ["new", "read"]),
        supabaseAdmin
          .from("course_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "new"),
        supabaseAdmin
          .from("course_participants")
          .select("id", { count: "exact", head: true })
          .eq("member_check", "pending")
          .eq("status", "confirmed"),
        (supabaseAdmin as any)
          .from("adult_course_interests")
          .select("id", { count: "exact", head: true })
          .eq("status", "new"),
        (supabaseAdmin as any)
          .from("family_swim_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "requested"),
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
        key: "member-check",
        label: "Mitgliedschaft prüfen (vor Zahlungsmail)",
        count: memberChecks.count ?? 0,
        to: "/admin/zahlungen",
        tone: "urgent",
        hint: "„Mitglied“ angegeben, aber nicht im System gefunden – Zahlungsmail erst nach Prüfung",
      },
      {
        key: "overdue",
        label: "Zahlungen überfällig",
        count: overdue.count ?? 0,
        to: "/admin/zahlungen",
        tone: "urgent",
        hint: "Zahlungsfrist ist abgelaufen",
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
        to: "/admin/archiv",
        tone: "attention",
      },
      {
        key: "adult-interest",
        label: "Erwachsenenschwimmen: neue Interessenten",
        count: adultNew.count ?? 0,
        to: "/admin/erwachsenenkurs",
        tone: "attention",
        hint: "Rückmeldungen mit Status „Neu“",
      },
      {
        key: "family-swim",
        label: "Mitgliederschwimmen: neue Vormerkungen",
        count: familyNew.count ?? 0,
        to: "/admin/familienschwimmen",
        tone: "attention",
        hint: "noch nicht verteilt",
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
        to: "/admin/dienstplan",
        tone: "info",
        hint: "in den nächsten 14 Tagen",
      },
    ];

    return { tasks };
  });
