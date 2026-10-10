import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchAll, fetchIn } from "@/lib/fetch-all";
import { escapeLike } from "@/lib/like";

const norm = (v: string | null | undefined) => (v ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export type FamilyEvent = {
  /** ISO-Zeitpunkt, nur zum Sortieren */
  at: string;
  /** Falls der Zeitpunkt aus einer Notiz stammt: Originaltext, sonst wird `at` formatiert */
  whenLabel?: string;
  kind: "request" | "waitlist" | "booking" | "payment" | "cancel" | "mail" | "block" | "note";
  title: string;
  detail?: string | null;
};

/** „[10.10.2026, 11:15:22] Text“ → Zeitpunkt + Text (Notizen der Verwaltung). */
function parseNotes(notes: string | null | undefined, title: string): FamilyEvent[] {
  const out: FamilyEvent[] = [];
  for (const line of (notes ?? "").split("\n")) {
    const m = line.match(
      /^\[(\d{1,2})\.(\d{1,2})\.(\d{4})[,\s]+(\d{1,2}):(\d{2})(?::\d{2})?\]\s*(.*)$/,
    );
    if (!m) continue;
    const [, d, mo, y, h, mi, text] = m;
    const iso = new Date(Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!)).toISOString();
    out.push({
      at: iso,
      whenLabel: `${d!.padStart(2, "0")}.${mo!.padStart(2, "0")}.${y}, ${h!.padStart(2, "0")}:${mi}`,
      kind: "note",
      title,
      detail: text,
    });
  }
  return out;
}

const inputSchema = z.object({
  email: z.string().trim().max(200).nullable(),
  childName: z.string().trim().max(120).nullable(),
});

/** Gesamtbild einer Familie: Anfrageliste, Buchungen, Absagen, Sperrliste, E-Mails und Zeitleiste. */
export const getFamilyOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!isStaff) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = norm(data.email);
    const child = norm(data.childName);
    if (!email && !child) throw new Error("E-Mail oder Kindname fehlt.");
    const match = (e: string | null | undefined, c: string | null | undefined) =>
      (!!email && norm(e) === email) || (!email && !!child && norm(c) === child);

    const [entriesAll, partsAll, requestsAll, blocks] = await Promise.all([
      fetchAll<any>((f, t) =>
        supabaseAdmin.from("waitlist_entries").select("*").order("id").range(f, t),
      ),
      fetchAll<any>((f, t) =>
        supabaseAdmin
          .from("course_participants")
          .select(
            "id,course_id,request_id,participant_name,participant_email,participant_phone,date_of_birth,status,paid,paid_at,price_amount,created_at,payment_due_date,transferred_at,transfer_reason,transferred_to_course_id,cancelled_at,cancel_reason,block_review_dismissed_at",
          )
          .order("id")
          .range(f, t),
      ),
      fetchAll<any>((f, t) =>
        supabaseAdmin
          .from("course_requests")
          .select("id,parent_name,parent_email,child_name,desired_course,status,created_at")
          .order("id")
          .range(f, t),
      ),
      supabaseAdmin
        .from("booking_blocklist")
        .select("id,child_name_norm,child_dob,email_norm,reason,active,created_at"),
    ]);
    if (blocks.error) throw new Error(blocks.error.message);

    const entries = entriesAll.filter((e) => match(e.parent_email, e.child_name));
    const parts = partsAll.filter((p) => match(p.participant_email, p.participant_name));
    const requests = requestsAll.filter((r) => match(r.parent_email, r.child_name));
    // Kinder der Familie (E-Mail-Treffer) und deren Sperrlisteneinträge
    const childNames = new Set(
      [
        ...entries.map((e) => norm(e.child_name)),
        ...parts.map((p) => norm(p.participant_name)),
      ].filter(Boolean),
    );
    if (child) childNames.add(child);
    const blockList = (blocks.data ?? []).filter(
      (b) =>
        (b.email_norm && b.email_norm === email) ||
        (b.child_name_norm && childNames.has(b.child_name_norm)),
    );

    const courseIds = [
      ...new Set(
        parts.flatMap((p) =>
          [p.course_id, p.transferred_to_course_id].filter((v: unknown): v is string => !!v),
        ),
      ),
    ];
    const courseNames = new Map<string, string>();
    if (courseIds.length) {
      const named = await fetchIn<{ id: string; name: string }>(courseIds, (chunk, f, t) =>
        supabaseAdmin.from("courses").select("id,name").in("id", chunk).order("id").range(f, t),
      );
      for (const c of named) courseNames.set(c.id, c.name);
    }
    const programIds = [...new Set(entries.map((e) => e.program_id).filter(Boolean))] as string[];
    const programNames = new Map<string, string>();
    if (programIds.length) {
      const { data: progs } = await supabaseAdmin
        .from("course_programs")
        .select("id,name")
        .in("id", programIds);
      for (const p of progs ?? []) programNames.set(p.id, p.name);
    }

    let mails: Array<{
      id: string;
      created_at: string;
      subject: string | null;
      template_name: string;
      status: string;
    }> = [];
    if (email) {
      const { data: m } = await supabaseAdmin
        .from("email_send_log")
        .select("id,created_at,subject,template_name,status,recipient_email")
        .ilike("recipient_email", escapeLike(email))
        .order("created_at", { ascending: false })
        .limit(100);
      mails = (m ?? []).filter((r) => norm(r.recipient_email) === email);
    }

    // Absagen/Stornierungen gesamt (gleiche Zählweise wie Sperrvorschlag)
    const { buildDeclineStats } = await import("@/lib/decline-stats.server");
    const cancellationRows = partsAll
      .filter((p) => p.status === "cancelled" && (p.transferred_at || p.cancelled_at))
      .map((p) => ({
        id: p.id,
        course_id: p.course_id,
        participant_name: p.participant_name,
        participant_email: p.participant_email,
        transfer_reason: p.transfer_reason,
        transferred_at: p.transferred_at,
        cancelled_at: p.cancelled_at,
        cancel_reason: p.cancel_reason,
        transferred_to_course_id: p.transferred_to_course_id,
        block_review_dismissed_at: p.block_review_dismissed_at,
      }));
    const statsFor = buildDeclineStats(
      entriesAll,
      cancellationRows,
      (blocks.data ?? []).filter((b) => b.active),
    );
    const stats = statsFor(data.email, [...childNames][0] ?? data.childName ?? null);

    const events: FamilyEvent[] = [];
    for (const r of requests)
      events.push({
        at: r.created_at,
        kind: "request",
        title: "Kursanfrage eingegangen",
        detail: [r.child_name, r.desired_course].filter(Boolean).join(" · ") || null,
      });
    for (const e of entries) {
      events.push({
        at: e.created_at,
        kind: "waitlist",
        title: `Auf der Anfrageliste: ${e.child_name}`,
        detail: e.program_id ? (programNames.get(e.program_id) ?? null) : null,
      });
      events.push(...parseNotes(e.admin_notes, `Anfrageliste · ${e.child_name}`));
    }
    for (const p of parts) {
      const course = courseNames.get(p.course_id) ?? "Kurs";
      events.push({
        at: p.created_at,
        kind: "booking",
        title: `Gebucht: ${p.participant_name ?? "Kind"} in „${course}“`,
        detail:
          p.price_amount != null
            ? `${Number(p.price_amount).toFixed(2).replace(".", ",")} €`
            : null,
      });
      if (p.paid_at)
        events.push({
          at: p.paid_at,
          kind: "payment",
          title: `Bezahlt: „${course}“`,
          detail: p.participant_name,
        });
      const cancelledAt = p.transferred_at ?? p.cancelled_at;
      if (p.status === "cancelled" && cancelledAt) {
        const moved = p.transferred_to_course_id
          ? `Umbuchung nach „${courseNames.get(p.transferred_to_course_id) ?? "anderer Kurs"}“`
          : p.transferred_at
            ? "Zurück auf die Warteliste"
            : "Absage in der Teilnehmerliste";
        events.push({
          at: cancelledAt,
          kind: "cancel",
          title: `${moved}: „${course}“`,
          detail: [p.participant_name, p.transfer_reason ?? p.cancel_reason]
            .filter(Boolean)
            .join(" · "),
        });
      }
    }
    for (const b of blockList)
      events.push({
        at: b.created_at,
        kind: "block",
        title: b.active ? "Auf der Sperrliste" : "Sperrlisteneintrag (inaktiv)",
        detail: b.reason,
      });
    for (const m of mails)
      events.push({
        at: m.created_at,
        kind: "mail",
        title: `E-Mail: ${m.subject ?? m.template_name}`,
        detail: m.status === "sent" ? null : `Status: ${m.status}`,
      });
    events.sort((a, b) => b.at.localeCompare(a.at));

    // Eltern- und Kinddaten zusammenführen
    const parentName =
      entries.find((e) => e.parent_name)?.parent_name ?? requests[0]?.parent_name ?? null;
    const phone =
      entries.find((e) => e.parent_phone)?.parent_phone ??
      parts.find((p) => p.participant_phone)?.participant_phone ??
      null;
    const children = [...childNames].map((n) => {
      const e = entries.find((x) => norm(x.child_name) === n);
      const p = parts.find((x) => norm(x.participant_name) === n);
      return {
        name: e?.child_name ?? p?.participant_name ?? n,
        dob: e?.child_dob ?? p?.date_of_birth ?? null,
      };
    });

    return {
      email: data.email,
      parentName,
      phone,
      children,
      declinesTotal: stats.total,
      blocked: blockList.some((b) => b.active),
      blockSuggestion: stats.suggest,
      entries: entries.map((e) => ({
        id: e.id,
        child_name: e.child_name as string,
        status: e.status as string,
        program: e.program_id ? (programNames.get(e.program_id) ?? null) : null,
        decline_count: Number(e.decline_count ?? 0),
        created_at: e.created_at as string,
        available_from: (e.available_from as string | null) ?? null,
      })),
      bookings: parts
        .map((p) => ({
          id: p.id as string,
          child_name: p.participant_name as string | null,
          course: courseNames.get(p.course_id) ?? "Kurs",
          status: p.status as string,
          paid: !!p.paid,
          paid_at: (p.paid_at as string | null) ?? null,
          due: (p.payment_due_date as string | null) ?? null,
          price: p.price_amount as number | null,
          created_at: p.created_at as string,
        }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      blocks: blockList.map((b) => ({
        id: b.id,
        active: b.active,
        reason: b.reason,
        created_at: b.created_at,
      })),
      mails: mails.slice(0, 30),
      events,
    };
  });
