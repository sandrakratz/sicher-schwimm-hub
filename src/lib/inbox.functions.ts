import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InboxSource = "message" | "course-request" | "waitlist";

export type InboxSummary = {
  /** Anmeldungen der letzten 30 Tage, die automatisch weiterlaufen (Angebot oder wartend ohne Anmerkung) */
  automatic: number;
  offered: number;
  waiting: number;
  /** Davon einzeln im Posteingang, weil die Eltern etwas geschrieben haben */
  withNote: number;
};

/** Freitext der Eltern ohne die strukturierten Zeilen „Schwimmlevel“ und „Wunschtag“. */
function parentFreeText(notes: string | null | undefined): string {
  return (notes ?? "")
    .split(/\r?\n/)
    .filter((l) => l.trim() && !/^\s*(Schwimm(level|niveau)|Wunschtage?):/i.test(l))
    .join("\n")
    .trim();
}

export type InboxItem = {
  source: InboxSource;
  id: string;
  name: string;
  email: string;
  subject: string;
  body: string;
  created_at: string;
  statusLabel: string;
  /** Ziel im Adminbereich, an dem der Vorgang vollständig bearbeitet werden kann */
  contextTo: string;
  /** Optionaler Reiter/Parameter der Zielseite */
  contextSearch?: { tab: "archive" };
  /** Wartelisteneintrag: Familie hat einen Freitext geschrieben, den das System nicht auswerten kann */
  hasParentNote?: boolean;
};

const REQUEST_STATUS: Record<string, string> = {
  new: "Neu",
  under_review: "In Prüfung",
  contacted: "Kontaktiert",
  accepted: "Angenommen",
  waiting_list: "Warteliste",
  rejected: "Abgelehnt",
};

const WAITLIST_STATUS: Record<string, string> = {
  waiting: "Wartend",
  offered: "Platz angeboten",
  accepted: "Zugesagt",
  declined: "Abgesagt",
  expired: "Frist abgelaufen",
  removed: "Entfernt",
};

/**
 * Ein gemeinsamer Posteingang: Kontaktformular, Kursanfragen und Wartelisten-Einträge
 * in einer Liste, damit Antworten nicht an zwei Stellen gesucht werden müssen.
 */
export const listInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: InboxItem[]; summary: InboxSummary }> => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!isStaff) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Nur offene Vorgänge gehören in den Posteingang – erledigte bleiben in der Warteliste sichtbar.
    const OPEN_REQUEST = ["new", "under_review"] as const;
    const OPEN_WAITLIST = ["waiting", "offered"] as const;
    // Wartelisten-Einträge nur als „neu“ zeigen (letzte 30 Tage), nicht die gesamte Warteliste
    const waitlistSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [requests, waitlist] = await Promise.all([
      supabaseAdmin
        .from("course_requests")
        .select(
          "id,parent_name,parent_email,child_name,desired_course,message,health_info,status,created_at",
        )
        .in("status", OPEN_REQUEST)
        .is("waitlist_archived_at", null)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("waitlist_entries")
        .select("id,parent_name,parent_email,child_name,notes,status,created_at")
        .in("status", OPEN_WAITLIST)
        .gte("created_at", waitlistSince)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const items: InboxItem[] = [];

    for (const r of requests.data ?? []) {
      const parts = [r.message, r.health_info ? `Gesundheitshinweise: ${r.health_info}` : null]
        .filter(Boolean)
        .join("\n\n");
      items.push({
        source: "course-request",
        id: r.id as string,
        name: (r.parent_name as string) || "—",
        email: (r.parent_email as string) || "",
        subject: `Kursanfrage${r.child_name ? ` – ${r.child_name}` : ""}${r.desired_course ? ` (${r.desired_course})` : ""}`,
        body: parts || "(keine Nachricht hinterlegt)",
        created_at: r.created_at as string,
        statusLabel: REQUEST_STATUS[r.status as string] ?? (r.status as string),
        // Kursanfragen stehen im Reiter „Frühere Kursanfragen“ (Anmeldungen)
        contextTo: "/admin/archiv",
      });
    }

    // Wartelisteneintrag-Anmeldungen laufen in aller Regel automatisch (Platzangebot per E-Mail, Zusage-Link).
    // Einzeln erscheinen nur wartende Einträge, bei denen die Eltern etwas geschrieben haben, das das
    // System nicht auswerten kann (z. B. Zeiten, Mitgliedschaft). Alles andere steht nur in der Zusammenfassung.
    const summary: InboxSummary = { automatic: 0, offered: 0, waiting: 0, withNote: 0 };
    for (const w of waitlist.data ?? []) {
      const note = parentFreeText(w.notes as string | null);
      if (w.status === "offered") summary.offered++;
      if (w.status === "waiting") summary.waiting++;
      if (w.status === "waiting" && note) {
        summary.withNote++;
        items.push({
          source: "waitlist",
          id: w.id as string,
          name: (w.parent_name as string) || "—",
          email: (w.parent_email as string) || "",
          subject: `Anmeldung${w.child_name ? ` – ${w.child_name}` : ""}`,
          body: note,
          created_at: w.created_at as string,
          statusLabel: WAITLIST_STATUS[w.status as string] ?? (w.status as string),
          contextTo: "/admin/warteliste",
          hasParentNote: true,
        });
      } else {
        summary.automatic++;
      }
    }

    items.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { items, summary };
  });
