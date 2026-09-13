import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InboxSource = "message" | "course-request" | "waitlist";

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
  .handler(async ({ context }): Promise<{ items: InboxItem[] }> => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!isStaff) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [requests, waitlist] = await Promise.all([
      supabaseAdmin
        .from("course_requests")
        .select("id,parent_name,parent_email,child_name,desired_course,message,health_info,status,created_at")
        .order("created_at", { ascending: false })
        .limit(300),
      supabaseAdmin
        .from("waitlist_entries")
        .select("id,parent_name,parent_email,child_name,notes,status,created_at")
        .order("created_at", { ascending: false })
        .limit(300),
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
        contextTo: "/admin/warteliste",
      });
    }

    for (const w of waitlist.data ?? []) {
      items.push({
        source: "waitlist",
        id: w.id as string,
        name: (w.parent_name as string) || "—",
        email: (w.parent_email as string) || "",
        subject: `Warteliste${w.child_name ? ` – ${w.child_name}` : ""}`,
        body: (w.notes as string) || "(keine Nachricht hinterlegt)",
        created_at: w.created_at as string,
        statusLabel: WAITLIST_STATUS[w.status as string] ?? (w.status as string),
        contextTo: "/admin/warteliste",
      });
    }

    items.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { items };
  });
