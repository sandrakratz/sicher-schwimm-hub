import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchIn } from "@/lib/fetch-all";

export const AUDIT_AREAS = {
  courses: {
    label: "Kurse & Teilnehmer",
    entities: ["courses", "course_participants", "course_sessions"],
  },
  waitlist: {
    label: "Anfrageliste",
    entities: ["waitlist_entries", "course_requests", "cancellation_request"],
  },
  blocklist: { label: "Sperrliste", entities: ["booking_blocklist"] },
  members: {
    label: "Mitglieder & Benutzer",
    entities: ["memberships", "profiles", "user_roles", "assignment_rules"],
  },
  comms: { label: "Kommunikation", entities: ["messages"] },
  money: { label: "Übungsleitergelder", entities: ["trainer_payout_details"] },
} as const;
export type AuditArea = keyof typeof AUDIT_AREAS;

export type AuditLink = { to: string; search?: Record<string, string> };

export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  actorId: string | null;
  area: string;
  /** Satz ohne Person, z. B. „hat Karolin Hopp einen Platz in ‚Bronze‘ angeboten“ */
  sentence: string;
  link: AuditLink | null;
  details: Array<[string, string]>;
};

const FIELD_LABEL: Record<string, string> = {
  status: "Status",
  admin_notes: "Interne Notiz",
  notes: "Anmerkung der Eltern",
  program_id: "Wunschkurs",
  course_id: "Kurs",
  child_name: "Name des Kindes",
  child_dob: "Geburtsdatum",
  parent_name: "Name der Eltern",
  parent_email: "E-Mail",
  parent_phone: "Telefon",
  is_member: "Mitglied",
  available_from: "„Erst zuteilen ab“",
  decline_count: "Absage-Zähler",
  assigned_to: "Zuständig",
  follow_up_on: "Wiedervorlage",
  block_review_dismissed_at: "Sperrvorschlag ignoriert",
  offer_token: "Angebot",
  offer_expires_at: "Angebotsfrist",
  offer_course_id: "Angebotener Kurs",
  followup_token: "Rückfrage",
  followup_expires_at: "Rückfragefrist",
};

const norm = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const q = (s: string) => `„${s}“`;

const inputSchema = z.object({
  actorId: z.string().uuid().nullable().optional(),
  area: z
    .enum(["courses", "waitlist", "blocklist", "members", "comms", "money"])
    .nullable()
    .optional(),
  text: z.string().trim().max(100).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  offset: z.number().int().min(0).max(100000).default(0),
});

const PAGE = 50;

/** Lesbares Audit-Log: wer hat wann was mit wem gemacht, mit Sprung zur betroffenen Familie bzw. zum Kurs. */
export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!isStaff) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Mit Suchtext wird breiter geladen und nach dem Aufbereiten gefiltert
    const searching = !!data.text;
    let query = supabaseAdmin
      .from("audit_logs")
      .select("id,actor_id,action,entity,entity_id,metadata,created_at")
      .order("created_at", { ascending: false })
      .order("id");
    if (data.actorId) query = query.eq("actor_id", data.actorId);
    if (data.area) query = query.in("entity", [...AUDIT_AREAS[data.area].entities]);
    if (data.from) query = query.gte("created_at", `${data.from}T00:00:00+02:00`);
    if (data.to) query = query.lte("created_at", `${data.to}T23:59:59+02:00`);
    query = searching ? query.range(0, 1999) : query.range(data.offset, data.offset + PAGE);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<{
      id: string;
      actor_id: string | null;
      action: string;
      entity: string;
      entity_id: string | null;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>;

    // Bezugsobjekte nachladen
    // Nicht jeder Bezug ist eine Kennung (Exporte tragen z. B. „2026“): nur echte UUIDs nachschlagen
    const isUuid = (v: unknown): v is string =>
      typeof v === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    const ids = (entity: string) => [
      ...new Set(
        list
          .filter((r) => r.entity === entity && isUuid(r.entity_id))
          .map((r) => r.entity_id as string),
      ),
    ];
    const metaCourseIds = list.flatMap((r) =>
      [r.metadata?.["course_id"], r.metadata?.["to"]].filter(isUuid),
    );

    const [parts, entries, requests, members, profilesAbout, msgs, sessions, blocks] =
      await Promise.all([
        fetchIn<any>(ids("course_participants"), (c, f, t) =>
          supabaseAdmin
            .from("course_participants")
            .select("id,participant_name,participant_email,course_id")
            .in("id", c)
            .order("id")
            .range(f, t),
        ),
        fetchIn<any>(ids("waitlist_entries"), (c, f, t) =>
          supabaseAdmin
            .from("waitlist_entries")
            .select("id,child_name,parent_email")
            .in("id", c)
            .order("id")
            .range(f, t),
        ),
        fetchIn<any>(ids("course_requests"), (c, f, t) =>
          supabaseAdmin
            .from("course_requests")
            .select("id,child_name,parent_name,parent_email")
            .in("id", c)
            .order("id")
            .range(f, t),
        ),
        fetchIn<any>(ids("memberships"), (c, f, t) =>
          supabaseAdmin
            .from("memberships")
            .select("id,first_name,last_name,email")
            .in("id", c)
            .order("id")
            .range(f, t),
        ),
        fetchIn<any>(ids("profiles"), (c, f, t) =>
          supabaseAdmin
            .from("profiles")
            .select("id,first_name,last_name,email")
            .in("id", c)
            .order("id")
            .range(f, t),
        ),
        fetchIn<any>(ids("messages"), (c, f, t) =>
          supabaseAdmin
            .from("messages")
            .select("id,from_name,from_email")
            .in("id", c)
            .order("id")
            .range(f, t),
        ),
        fetchIn<any>(ids("course_sessions"), (c, f, t) =>
          supabaseAdmin
            .from("course_sessions")
            .select("id,course_id,session_date")
            .in("id", c)
            .order("id")
            .range(f, t),
        ),
        fetchIn<any>(ids("booking_blocklist"), (c, f, t) =>
          supabaseAdmin
            .from("booking_blocklist")
            .select("id,child_name_norm,email_norm")
            .in("id", c)
            .order("id")
            .range(f, t),
        ),
      ]);
    const courseIdSet = new Set<string>([
      ...ids("courses"),
      ...metaCourseIds,
      ...parts.map((p) => p.course_id as string),
      ...sessions.map((s) => s.course_id as string),
    ]);
    const courseRows = await fetchIn<{ id: string; name: string }>([...courseIdSet], (c, f, t) =>
      supabaseAdmin.from("courses").select("id,name").in("id", c).order("id").range(f, t),
    );
    const courseName = new Map(courseRows.map((c) => [c.id, c.name]));

    const actorIds = [...new Set(list.map((r) => r.actor_id).filter(isUuid))];
    const actorRows = await fetchIn<any>(actorIds, (c, f, t) =>
      supabaseAdmin
        .from("profiles")
        .select("id,first_name,last_name,email")
        .in("id", c)
        .order("id")
        .range(f, t),
    );
    const personName = (p: {
      first_name: string | null;
      last_name: string | null;
      email?: string;
    }) => [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unbekannt";
    const actorName = new Map(actorRows.map((a) => [a.id as string, personName(a)]));

    const partMap = new Map(parts.map((p) => [p.id as string, p]));
    const entryMap = new Map(entries.map((e) => [e.id as string, e]));
    const requestMap = new Map(requests.map((r) => [r.id as string, r]));
    const memberMap = new Map(members.map((m) => [m.id as string, m]));
    const profileMap = new Map(profilesAbout.map((p) => [p.id as string, p]));
    const msgMap = new Map(msgs.map((m) => [m.id as string, m]));
    const sessionMap = new Map(sessions.map((s) => [s.id as string, s]));
    const blockMap = new Map(blocks.map((b) => [b.id as string, b]));

    const events: AuditEvent[] = list.map((r) => {
      const m = r.metadata ?? {};
      let target = "";
      let email = "";
      let link: AuditLink | null = null;
      const famLink = (e: string) => (e ? { to: "/admin/familie", search: { email: e } } : null);

      switch (r.entity) {
        case "course_participants": {
          const p = partMap.get(r.entity_id ?? "");
          target = p?.participant_name ?? norm(m["child"]) ?? "";
          email = p?.participant_email ?? norm(m["email"]);
          link = famLink(email);
          break;
        }
        case "waitlist_entries": {
          const e = entryMap.get(r.entity_id ?? "");
          target = e?.child_name ?? norm(m["child"]);
          email = e?.parent_email ?? norm(m["email"]);
          link = famLink(email);
          break;
        }
        case "course_requests":
        case "cancellation_request": {
          const x = requestMap.get(r.entity_id ?? "");
          target = x?.child_name ?? x?.parent_name ?? norm(m["child"]);
          email = x?.parent_email ?? norm(m["email"]);
          link = famLink(email);
          break;
        }
        case "courses":
          target = courseName.get(r.entity_id ?? "") ?? norm(m["course"]);
          link = { to: "/admin/kurse" };
          break;
        case "course_sessions": {
          const s = sessionMap.get(r.entity_id ?? "");
          target = s ? (courseName.get(s.course_id) ?? "") : "";
          link = { to: "/admin/kalender" };
          break;
        }
        case "memberships": {
          const x = memberMap.get(r.entity_id ?? "");
          target = x ? `${x.first_name} ${x.last_name}` : "";
          link = { to: "/admin/mitgliedschaften" };
          break;
        }
        case "profiles":
        case "user_roles": {
          const x = profileMap.get(r.entity_id ?? "");
          target = x ? personName(x) : "";
          link = { to: "/admin/benutzer" };
          break;
        }
        case "messages": {
          const x = msgMap.get(r.entity_id ?? "");
          target = x?.from_name ?? "";
          email = x?.from_email ?? "";
          link = { to: "/admin/nachrichten" };
          break;
        }
        case "booking_blocklist":
          {
            const b = blockMap.get(r.entity_id ?? "");
            target =
              norm(m["child"]) ||
              norm(m["email"]) ||
              (b ? b.child_name_norm || b.email_norm || "" : "");
          }
          link = { to: "/admin/sperrliste" };
          break;
        case "trainer_payout_details":
          link = { to: "/admin/uebungsleitergelder" };
          break;
        default:
          break;
      }
      const t = target ? q(target) : "einen Eintrag";
      const course = (v: unknown) => (typeof v === "string" ? (courseName.get(v) ?? v) : "");
      const reason = norm(m["reason"]);
      const mCourse = norm(m["course"]) || course(m["course_id"]);

      const sentence = (() => {
        switch (r.action) {
          case "course.participant.cancelled":
            return `hat die Buchung von ${q(target)} abgesagt${reason ? ` (Grund: ${reason})` : ""}`;
          case "course.participant.moved_to_waitlist":
            return `hat ${q(target)} aus dem Kurs zurück auf die Anfrageliste gesetzt`;
          case "participant.returned_to_waitlist":
            return `hat ${q(target)} auf Wunsch der Familie zurück auf die Anfrageliste gesetzt${reason ? ` (Grund: ${reason})` : ""}`;
          case "participant.transferred":
            return `hat ${q(target)} umgebucht${m["to"] ? ` nach ${q(course(m["to"]))}` : ""}`;
          case "course.participant.assigned":
            return `hat ${t} einem Kurs zugeteilt`;
          case "course.participant.unassigned":
            return `hat ${t} aus der Zuteilung genommen`;
          case "course_participant.removed":
            return `hat ${t} aus dem Kurs entfernt${reason ? ` (Grund: ${reason})` : ""}`;
          case "participant.belt_updated":
          case "participant.hint_updated":
          case "participant.phone_updated":
          case "participant.result_updated":
            return `hat Angaben zu ${t} geändert`;
          case "waitlist.offered":
            return `hat ${t} einen Platz in ${q(mCourse || "einem Kurs")} angeboten`;
          case "waitlist.booked_directly":
            return `hat ${t} direkt in ${q(mCourse || "einen Kurs")} gebucht`;
          case "waitlist.decline_recorded":
            return `hat die Absage zu einem Platzangebot von ${t} erfasst`;
          case "waitlist.updated": {
            const fields = Array.isArray(m["fields"])
              ? (m["fields"] as string[])
                  .filter(
                    (f) =>
                      ![
                        "offer_token",
                        "offer_expires_at",
                        "followup_token",
                        "followup_expires_at",
                      ].includes(f),
                  )
                  .map((f) => FIELD_LABEL[f] ?? f)
              : [];
            const who = m["assigned_to"] ? ` (zuständig: ${String(m["assigned_to"])})` : "";
            return `hat den Eintrag von ${t} bearbeitet${fields.length ? `: ${fields.join(", ")}` : ""}${who}`;
          }
          case "waitlist.deleted":
            return `hat den Anfrageliste-Eintrag von ${t} gelöscht`;
          case "waitlist.allocated":
            return `hat „Plätze jetzt vergeben“ ausgeführt (${String(m["offers"] ?? 0)} neue Angebote)`;
          case "waitlist.replied":
            return `hat ${t} per E-Mail geantwortet`;
          case "waitlist.block_dismissed":
            return `hat den Sperrvorschlag für ${t} ignoriert`;
          case "blocklist.added":
            return `hat ${t} auf die Sperrliste gesetzt${reason ? ` (Grund: ${reason})` : ""}`;
          case "blocklist.deleted":
            return `hat den Sperrlisteneintrag${target ? ` für ${q(target)}` : ""} gelöscht`;
          case "blocklist.activated":
            return `hat den Sperrlisteneintrag${target ? ` für ${q(target)}` : ""} wieder aktiviert (gesperrt)`;
          case "blocklist.deactivated":
            return `hat den Sperrlisteneintrag${target ? ` für ${q(target)}` : ""} deaktiviert (nicht mehr gesperrt)`;
          case "message.replied":
            return `hat die Nachricht von ${t} beantwortet`;
          case "course_request.replied":
            return `hat die Kursanfrage von ${t} beantwortet`;
          case "course.cancelled":
            return `hat den Kurs ${t} abgesagt${reason ? ` (Grund: ${reason})` : ""}`;
          case "course.rescheduled":
            return `hat Termine von ${t} verschoben`;
          case "course.broadcast":
            return `hat eine Info-Mail an die Familien von ${t} gesendet`;
          case "membership.deleted":
            return `hat die Mitgliedschaft von ${t} gelöscht`;
          case "membership.repriced":
          case "membership.prices_synced":
            return "hat Mitgliedsbeiträge angepasst";
          case "user.deleted":
            return `hat das Benutzerkonto von ${t} gelöscht`;
          case "user.status_changed":
            return `hat den Status von ${t} geändert${m["status"] ? ` (${String(m["status"])})` : ""}`;
          case "assignment.changed": {
            const to = norm(m["to"]);
            const from = norm(m["from"]);
            const note = norm(m["note"]);
            const base = to
              ? from
                ? `hat ${t} von ${from} an ${to} weitergegeben`
                : `hat ${t} an ${to} zugewiesen`
              : `hat die Zuweisung von ${t} aufgehoben`;
            return `${base}${note ? ` (Notiz: ${note})` : ""}`;
          }
          case "assignment.rule_changed":
            return `hat die Standard-Zuständigkeit „${norm(m["area"])}“ auf ${norm(m["assignee"]) || "niemanden"} gesetzt`;
          case "attendance_recorded":
          case "trainer_attendance_recorded":
            return `hat die Anwesenheit erfasst${target ? ` (${q(target)})` : ""}`;
          case "user.role_granted":
            return `hat ${t} eine Rolle zugewiesen${m["role"] ? ` (${String(m["role"])})` : ""}`;
          case "user.role_revoked":
            return `hat ${t} eine Rolle entzogen${m["role"] ? ` (${String(m["role"])})` : ""}`;
          default: {
            if (r.action.startsWith("membership.")) {
              const status: Record<string, string> = {
                pending: "„wartet auf Freigabe“",
                active: "„aktiv“",
                suspended: "„pausiert“",
                terminated: "„beendet“",
              };
              const s = r.action.replace("membership.", "");
              return `hat die Mitgliedschaft von ${t} auf ${status[s] ?? q(s)} gesetzt`;
            }
            if (r.action === "trainer.payout.listed")
              return "hat die Auszahlungsdaten der Übungsleitergelder eingesehen";
            if (r.action.startsWith("trainer.payout."))
              return "hat Auszahlungsdaten der Übungsleitergelder geändert";
            const exports: Record<string, string> = {
              course_list: "Kursliste",
              tax_participant_list: "Teilnehmerliste für das Finanzamt",
              exam_protocol: "Prüfungsprotokoll",
              trainer_proof: "Trainer-Nachweis",
              course_confirmations: "Kursbestätigungen",
              meinverein_csv: "MeinVerein-Datei",
            };
            if (r.action.endsWith("_exported")) {
              const key = r.action.replace(/_exported$/, "");
              return `hat eine Liste exportiert: ${exports[key] ?? key.replace(/_/g, " ")}`;
            }
            return `hat „${r.action}“ ausgeführt${target ? ` (${q(target)})` : ""}`;
          }
        }
      })();

      const details: Array<[string, string]> = Object.entries(m)
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => [
          FIELD_LABEL[k] ?? k,
          typeof v === "object" ? JSON.stringify(v) : String(v),
        ]);
      const area =
        (Object.entries(AUDIT_AREAS).find(([, a]) =>
          (a.entities as readonly string[]).includes(r.entity),
        )?.[1].label as string | undefined) ?? "Sonstiges";

      return {
        id: r.id,
        at: r.created_at,
        actor: r.actor_id ? (actorName.get(r.actor_id) ?? "Unbekannt") : "System",
        actorId: r.actor_id,
        area,
        sentence,
        link,
        details,
      };
    });

    let result = events;
    if (searching) {
      const needle = data.text!.toLowerCase();
      result = events.filter((e) =>
        `${e.actor} ${e.sentence} ${e.area} ${e.details.map(([k, v]) => `${k} ${v}`).join(" ")}`
          .toLowerCase()
          .includes(needle),
      );
    }
    const page = searching ? result.slice(data.offset, data.offset + PAGE) : result.slice(0, PAGE);
    const hasMore = searching ? result.length > data.offset + PAGE : result.length > PAGE;

    // Personen für den Filter: Mitarbeitende, die schon etwas protokolliert haben
    const { data: actorsRaw } = await supabaseAdmin
      .from("audit_logs")
      .select("actor_id")
      .not("actor_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(2000);
    const filterIds = [...new Set((actorsRaw ?? []).map((a) => a.actor_id as string))];
    const filterRows = await fetchIn<any>(filterIds, (c, f, t) =>
      supabaseAdmin
        .from("profiles")
        .select("id,first_name,last_name,email")
        .in("id", c)
        .order("id")
        .range(f, t),
    );
    const actors = filterRows
      .map((p) => ({ id: p.id as string, name: personName(p) }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));

    return { events: page, hasMore, actors };
  });
