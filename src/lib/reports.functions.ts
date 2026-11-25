/* eslint-disable @typescript-eslint/no-explicit-any -- neuere Tabellen/Spalten fehlen in den generierten Typen */
// Auswertungen und Exporte der Verwaltung (Seite „Downloads“) sowie Geburtstage im Eingang.
// Jeder Export wird im Verwaltungsprotokoll vermerkt.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/auth-guards.server";
import {
  activeOn,
  ageGroupLabels,
  ageOn,
  badgeStats,
  census,
  DEFAULT_AGE_BOUNDS,
  demandStats,
  personsOf,
  upcomingBirthdays,
  type MembershipRow,
} from "@/lib/reports";

type FileResult = { filename: string; base64: string; rows: number };

const yearSchema = z.object({ year: z.number().int().min(2020).max(2100) });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const TYPE_LABEL: Record<string, string> = {
  children_youth: "Kinder/Jugend",
  adult: "Erwachsene",
  family: "Familie",
  supporting: "Fördermitglied",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Antrag offen",
  active: "Aktiv",
  suspended: "Ruhend",
  terminated: "Beendet",
};
const GENDER_LABEL: Record<string, string> = { w: "weiblich", m: "männlich", d: "divers" };
const de = (iso: string | null | undefined) =>
  iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "";

async function audit(userId: string, action: string, metadata: Record<string, unknown>) {
  const { logAudit } = await import("@/lib/audit.server");
  await logAudit(null, userId, { action, entity: "reports", metadata });
}

async function loadMemberships(): Promise<MembershipRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { fetchAll } = await import("@/lib/fetch-all");
  return fetchAll<MembershipRow>((f, t) =>
    (supabaseAdmin as any)
      .from("memberships")
      .select(
        "id,first_name,last_name,date_of_birth,gender,email,member_email,guardian_email,membership_type,status,start_date,valid_until,approved_at,created_at,family_members",
      )
      .order("id")
      .range(f, t),
  );
}

/** Abzeichen-Statistik eines Jahres: nur Zahlen je Abzeichen (Kurs/extern). */
export const exportBadgeStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => yearSchema.parse(i))
  .handler(async ({ data, context }): Promise<FileResult> => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchAll } = await import("@/lib/fetch-all");
    const db = supabaseAdmin as any;
    const [parts, courses, external] = await Promise.all([
      fetchAll<any>((f, t) =>
        db
          .from("course_participants")
          .select("id,course_id,exam_level,goal_reached,exam_date")
          .not("exam_level", "is", null)
          .order("id")
          .range(f, t),
      ),
      fetchAll<any>((f, t) => db.from("courses").select("id,ends_on").order("id").range(f, t)),
      fetchAll<any>((f, t) =>
        db
          .from("external_badge_exams")
          .select("id,exam_level,goal_reached,exam_date")
          .order("id")
          .range(f, t),
      ),
    ]);
    const endOf = new Map(courses.map((c: any) => [c.id as string, c.ends_on as string | null]));
    const stats = badgeStats(
      [
        ...parts.map((p: any) => ({
          exam_level: p.exam_level,
          goal_reached: p.goal_reached,
          date: p.exam_date ?? endOf.get(p.course_id) ?? null,
          source: "kurs" as const,
        })),
        ...external.map((e: any) => ({
          exam_level: e.exam_level,
          goal_reached: e.goal_reached,
          date: e.exam_date,
          source: "extern" as const,
        })),
      ],
      data.year,
    );
    const { workbookBase64 } = await import("@/lib/xlsx.server");
    const sum = (k: "kurs" | "extern" | "gesamt" | "nichtBestanden") =>
      stats.reduce((n, s) => n + s[k], 0);
    const base64 = await workbookBase64([
      {
        name: `Abzeichen ${data.year}`,
        title: `Abgenommene Abzeichen ${data.year}`,
        note: "Bestandene Prüfungen nach Prüfungsdatum (ersatzweise Kursende). „Extern“ = Abnahmen ohne Kursbuchung. Ohne Namen.",
        header: ["Abzeichen", "In Kursen", "Extern", "Bestanden gesamt", "Nicht bestanden"],
        rows: stats.map((s) => [s.label, s.kurs, s.extern, s.gesamt, s.nichtBestanden]),
        footer: ["Summe", sum("kurs"), sum("extern"), sum("gesamt"), sum("nichtBestanden")],
      },
    ]);
    await audit(context.userId, "report.badges.exported", { year: data.year });
    return { filename: `Abzeichen_${data.year}.xlsx`, base64, rows: stats.length };
  });

/** Auslastung und Nachfrage je Angebot eines Jahres, dazu jeder Kurs einzeln. */
export const exportDemand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => yearSchema.parse(i))
  .handler(async ({ data, context }): Promise<FileResult> => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchAll } = await import("@/lib/fetch-all");
    const db = supabaseAdmin as any;
    const [courses, parts, entries, programs] = await Promise.all([
      fetchAll<any>((f, t) =>
        db
          .from("courses")
          .select("id,name,program_id,starts_on,ends_on,location,max_participants,status")
          .order("starts_on")
          .order("id")
          .range(f, t),
      ),
      fetchAll<any>((f, t) =>
        db.from("course_participants").select("id,course_id,status").order("id").range(f, t),
      ),
      fetchAll<any>((f, t) =>
        db
          .from("waitlist_entries")
          .select("id,program_id,created_at,status,decline_count")
          .order("id")
          .range(f, t),
      ),
      db.from("course_programs").select("id,name,sort_order").order("sort_order"),
    ]);
    const count = new Map<string, { confirmed: number; cancelled: number }>();
    for (const p of parts) {
      const c = count.get(p.course_id) ?? { confirmed: 0, cancelled: 0 };
      if (p.status === "confirmed") c.confirmed++;
      if (p.status === "cancelled") c.cancelled++;
      count.set(p.course_id, c);
    }
    const withCounts = courses.map((c: any) => ({
      ...c,
      confirmed: count.get(c.id)?.confirmed ?? 0,
      cancelled: count.get(c.id)?.cancelled ?? 0,
    }));
    const stats = demandStats(withCounts, entries, data.year);
    const progName = new Map<string, string>(
      ((programs.data ?? []) as any[]).map((p) => [p.id as string, p.name as string]),
    );
    const order = new Map<string, number>(
      ((programs.data ?? []) as any[]).map((p, i) => [p.id as string, i]),
    );
    stats.sort(
      (a, b) => (order.get(a.programId ?? "") ?? 999) - (order.get(b.programId ?? "") ?? 999),
    );
    const { workbookBase64 } = await import("@/lib/xlsx.server");
    const pct = (v: number | null) => (v == null ? "" : `${v} %`);
    const ofYear = withCounts.filter((c: any) => c.starts_on?.startsWith(`${data.year}-`));
    const base64 = await workbookBase64([
      {
        name: "Je Angebot",
        title: `Auslastung und Nachfrage ${data.year}`,
        note: "Kurse mit Start im Jahr. Anfragen = neue Einträge in der Anfrageliste im Jahr; „wartend“ = Stand heute.",
        header: [
          "Angebot",
          "Kurse",
          "Plätze",
          "Gebucht",
          "Auslastung",
          "Storniert",
          "Neue Anfragen",
          "Abgesagte Angebote",
          "Wartend (heute)",
        ],
        rows: stats.map((s) => [
          s.programId ? (progName.get(s.programId) ?? "Unbekannt") : "Ohne Zuordnung",
          s.kurse,
          s.plaetze,
          s.gebucht,
          pct(s.auslastung),
          s.storniert,
          s.neueAnfragen,
          s.absagenAngebote,
          s.wartendJetzt,
        ]),
      },
      {
        name: "Je Kurs",
        title: `Kurse mit Start ${data.year}`,
        header: [
          "Kurs",
          "Angebot",
          "Beginn",
          "Ende",
          "Ort",
          "Plätze",
          "Gebucht",
          "Auslastung",
          "Storniert",
        ],
        rows: ofYear.map((c: any) => [
          c.name,
          c.program_id ? (progName.get(c.program_id) ?? "") : "",
          de(c.starts_on),
          de(c.ends_on),
          c.location ?? "",
          c.max_participants ?? "",
          c.confirmed,
          c.max_participants ? pct(Math.round((c.confirmed / c.max_participants) * 100)) : "",
          c.cancelled,
        ]),
      },
    ]);
    await audit(context.userId, "report.demand.exported", { year: data.year });
    return { filename: `Auslastung_Nachfrage_${data.year}.xlsx`, base64, rows: stats.length };
  });

/** Nachweise aller Trainer:innen mit Ablaufdatum und fehlenden Pflichtnachweisen. */
export const exportQualifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FileResult> => {
    await assertStaff(context);
    const { loadQualificationOverview } = await import("@/lib/qualifications.server");
    const { QUALIFICATION_KINDS, qualificationLabel } =
      await import("@/lib/trainer-qualifications");
    const { todayBerlinIso, addDaysIso } = await import("@/lib/format");
    const today = todayBerlinIso();
    const soon = addDaysIso(today, 60);
    const list = await loadQualificationOverview();
    const rows: unknown[][] = [];
    for (const t of list) {
      for (const q of t.qualifications) {
        const status = !q.valid_until
          ? "unbefristet"
          : q.valid_until < today
            ? "ABGELAUFEN"
            : q.valid_until <= soon
              ? "läuft bald ab"
              : "gültig";
        rows.push([
          t.name,
          qualificationLabel(q.kind),
          de(q.issued_on),
          de(q.valid_until),
          status,
          q.checked ? "ja" : "nein",
          q.note ?? "",
        ]);
      }
      for (const k of QUALIFICATION_KINDS.filter((k) => k.required)) {
        if (!t.qualifications.some((q) => q.kind === k.value))
          rows.push([t.name, k.label, "", "", "FEHLT", "", ""]);
      }
    }
    const { workbookBase64 } = await import("@/lib/xlsx.server");
    const base64 = await workbookBase64([
      {
        name: "Qualifikationen",
        title: "Nachweise der Trainer:innen",
        note: `Stand ${de(today)}. „Läuft bald ab“ = innerhalb von 60 Tagen.`,
        header: [
          "Trainer:in",
          "Nachweis",
          "Ausgestellt",
          "Gültig bis",
          "Status",
          "Geprüft",
          "Notiz",
        ],
        rows,
      },
    ]);
    await audit(context.userId, "report.qualifications.exported", { rows: rows.length });
    return { filename: `Trainer-Qualifikationen_${today}.xlsx`, base64, rows: rows.length };
  });

/** Mitgliederliste zum Stichtag: alle Personen inkl. Partner:in und Kinder (Abgleich mit MeinVerein). */
export const exportMemberRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ day: isoDate }).parse(i))
  .handler(async ({ data, context }): Promise<FileResult> => {
    await assertStaff(context);
    const memberships = (await loadMemberships()).filter((m) => activeOn(m, data.day));
    const persons = memberships
      .flatMap(personsOf)
      .sort(
        (a, b) =>
          a.nachname.localeCompare(b.nachname, "de") || a.vorname.localeCompare(b.vorname, "de"),
      );
    const { workbookBase64 } = await import("@/lib/xlsx.server");
    const base64 = await workbookBase64([
      {
        name: "Mitglieder",
        title: `Mitglieder am ${de(data.day)}`,
        note: `${memberships.length} Mitgliedschaften, ${persons.length} Personen (inkl. Familienmitglieder). Enthält personenbezogene Daten – nur für den Vorstand.`,
        header: [
          "Nachname",
          "Vorname",
          "Geburtsdatum",
          "Alter",
          "Geschlecht",
          "Rolle",
          "Mitgliedsart",
          "Status",
          "Eintritt",
          "Austritt",
          "E-Mail",
          "Mitgliedschaft (Kennung)",
        ],
        rows: persons.map((p) => [
          p.nachname,
          p.vorname,
          de(p.geburtsdatum),
          ageOn(p.geburtsdatum, data.day) ?? "",
          GENDER_LABEL[p.geschlecht ?? ""] ?? "",
          p.rolle,
          TYPE_LABEL[p.membershipType] ?? p.membershipType,
          STATUS_LABEL[p.status] ?? p.status,
          de(p.eintritt),
          de(p.austritt),
          p.email ?? "",
          p.membershipId.slice(0, 8),
        ]),
      },
    ]);
    await audit(context.userId, "report.members.exported", { day: data.day, rows: persons.length });
    return { filename: `Mitglieder_${data.day}.xlsx`, base64, rows: persons.length };
  });

/** Bestandsmeldung: alle Mitglieder inkl. Familienmitglieder nach Altersgruppe und Geschlecht. */
export const exportMembershipCensus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        day: isoDate,
        bounds: z.array(z.number().int().min(0).max(120)).min(1).max(15).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<FileResult> => {
    await assertStaff(context);
    const bounds = data.bounds ?? DEFAULT_AGE_BOUNDS;
    const persons = (await loadMemberships())
      .filter((m) => activeOn(m, data.day))
      .flatMap(personsOf);
    const c = census(persons, data.day, bounds);
    const row = (r: (typeof c.rows)[number]) => [r.gruppe, r.w, r.m, r.d, r.ohne, r.gesamt];
    const missing = [
      ...c.ohneGeschlecht.map((p) => [`${p.vorname} ${p.nachname}`, p.rolle, "Geschlecht fehlt"]),
      ...c.ohneGeburtsdatum.map((p) => [
        `${p.vorname} ${p.nachname}`,
        p.rolle,
        "Geburtsdatum fehlt (nicht gezählt)",
      ]),
    ];
    const { workbookBase64 } = await import("@/lib/xlsx.server");
    const base64 = await workbookBase64([
      {
        name: "Bestandsmeldung",
        title: `Mitgliederbestand am ${de(data.day)}`,
        note: `Alle Mitglieder einschließlich Partner:in und Kinder aus Familienmitgliedschaften. Alter am Stichtag, Altersgruppen: ${ageGroupLabels(bounds).join(" · ")}.`,
        header: ["Altersgruppe", "weiblich", "männlich", "divers", "ohne Angabe", "gesamt"],
        rows: c.rows.map(row),
        footer: row(c.total),
      },
      {
        name: "Fehlende Angaben",
        title: "Bitte in der Verwaltung ergänzen",
        note: "Verwaltung › Familien › Mitgliedschaften › Details. Enthält Namen – nur für den Vorstand.",
        header: ["Name", "Rolle", "Was fehlt"],
        rows: missing,
      },
    ]);
    await audit(context.userId, "report.census.exported", {
      day: data.day,
      persons: persons.length,
    });
    return { filename: `Bestandsmeldung_${data.day}.xlsx`, base64, rows: persons.length };
  });

// ---------- Datenauskunft (Art. 15 DSGVO) ----------

/** Tabellen mit Personenbezug und die Spalte, über die die E-Mail-Adresse zugeordnet wird. */
const SUBJECT_TABLES: Array<{ sheet: string; table: string; columns: string[]; lower?: boolean }> =
  [
    { sheet: "Konto", table: "profiles", columns: ["email"] },
    {
      sheet: "Mitgliedschaft",
      table: "memberships",
      columns: ["email", "member_email", "guardian_email"],
    },
    { sheet: "Kursbuchungen", table: "course_participants", columns: ["participant_email"] },
    { sheet: "Anfrageliste", table: "waitlist_entries", columns: ["parent_email"] },
    { sheet: "Kursanfragen (alt)", table: "course_requests", columns: ["parent_email"] },
    { sheet: "Widerrufe", table: "cancellation_requests", columns: ["email"] },
    { sheet: "Nachrichten", table: "messages", columns: ["from_email"] },
    { sheet: "Volljährigkeit", table: "majority_confirmations", columns: ["email"] },
    { sheet: "Erwachsenenschwimmen", table: "adult_course_interests", columns: ["email"] },
    { sheet: "Mitgliederschwimmen", table: "family_swim_requests", columns: ["contact_email"] },
    { sheet: "Sperrliste", table: "booking_blocklist", columns: ["email_norm"], lower: true },
    { sheet: "E-Mail-Sperre", table: "suppressed_emails", columns: ["email"] },
  ];

/** Geheime Link-Schlüssel und große Mailtexte gehören nicht in die Auskunft. */
const OMIT = /token|secret|password|body_html|body_text/i;

/** Alle gespeicherten Daten zu einer E-Mail-Adresse als Excel (eine Seite je Bereich). */
export const exportSubjectAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ email: z.string().trim().email().max(200) }).parse(i))
  .handler(async ({ data, context }): Promise<FileResult> => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { escapeLike } = await import("@/lib/like");
    const db = supabaseAdmin as any;
    const email = data.email.toLowerCase();
    const sheets: import("@/lib/xlsx.server").Sheet[] = [];
    const overview: unknown[][] = [];
    let total = 0;
    for (const t of SUBJECT_TABLES) {
      const filter = t.columns
        .map((c) => (t.lower ? `${c}.eq.${email}` : `${c}.ilike.${escapeLike(email)}`))
        .join(",");
      const { data: rows, error } = await db.from(t.table).select("*").or(filter).limit(500);
      if (error) {
        // Tabelle fehlt in diesem Stand der Datenbank: in der Übersicht vermerken statt abzubrechen
        overview.push([t.sheet, "nicht abrufbar", error.message]);
        continue;
      }
      const list = (rows ?? []) as Record<string, unknown>[];
      overview.push([t.sheet, list.length, ""]);
      if (list.length === 0) continue;
      total += list.length;
      const cols = Object.keys(list[0]!).filter((c) => !OMIT.test(c));
      sheets.push({ name: t.sheet, header: cols, rows: list.map((r) => cols.map((c) => r[c])) });
    }
    // Versandprotokoll ohne Mailtexte (Betreff, Datum, Status)
    const { data: mails } = await db
      .from("email_send_log")
      .select("created_at,template_name,subject,status,recipient_email")
      .ilike("recipient_email", escapeLike(email))
      .order("created_at", { ascending: false })
      .limit(1000);
    overview.push(["Versandprotokoll E-Mails", (mails ?? []).length, "ohne Mailtexte"]);
    if ((mails ?? []).length > 0) {
      total += mails.length;
      sheets.push({
        name: "E-Mails",
        header: ["Zeitpunkt", "Art", "Betreff", "Status"],
        rows: mails.map((m: any) => [m.created_at, m.template_name, m.subject, m.status]),
      });
    }
    const { todayBerlinIso } = await import("@/lib/format");
    const { workbookBase64 } = await import("@/lib/xlsx.server");
    const base64 = await workbookBase64([
      {
        name: "Übersicht",
        title: `Datenauskunft für ${data.email}`,
        note: `Erstellt am ${de(todayBerlinIso())}. Bitte vor dem Versand prüfen; interne Notizen der Verwaltung gehören zur Auskunft dazu.`,
        header: ["Bereich", "Einträge", "Hinweis"],
        rows: overview,
      },
      ...sheets,
    ]);
    await audit(context.userId, "report.subject_access.exported", { email, rows: total });
    return {
      filename: `Datenauskunft_${email.replace(/[^a-z0-9]+/g, "_")}_${todayBerlinIso()}.xlsx`,
      base64,
      rows: total,
    };
  });

// ---------- Geburtstage ----------

export type BirthdayItem = {
  key: string;
  membershipId: string;
  name: string;
  rolle: string;
  tag: string;
  inTagen: number;
  wirdAlt: number;
  hasEmail: boolean;
  /** Bereits in diesem Jahr gratuliert (laut Versandprotokoll) */
  sentAt: string | null;
};

/** Geburtstage von 3 Tagen zurück (nachträglich gratulieren) bis 30 Tage voraus; inTagen < 0 = vorbei. */
async function birthdayWindow(persons: ReturnType<typeof personsOf>) {
  const { todayBerlinIso, addDaysIso } = await import("@/lib/format");
  const today = todayBerlinIso();
  return upcomingBirthdays(persons, addDaysIso(today, -BACK), 30 + BACK).map((b) => ({
    ...b,
    inTagen: b.inTagen - BACK,
  }));
}
const BACK = 3;

const keyOf = (membershipId: string, rolle: string, vorname: string) =>
  `${membershipId}|${rolle}|${vorname.toLowerCase()}`;

/** Mitglieder (inkl. Familienmitglieder) mit Geburtstag in den nächsten 30 (und letzten 3) Tagen. */
export const listUpcomingBirthdays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BirthdayItem[]> => {
    await assertStaff(context);
    const { todayBerlinIso } = await import("@/lib/format");
    const today = todayBerlinIso();
    const persons = (await loadMemberships()).filter((m) => activeOn(m, today)).flatMap(personsOf);
    const list = await birthdayWindow(persons);
    if (list.length === 0) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sent } = await (supabaseAdmin as any)
      .from("email_send_log")
      .select("created_at,metadata")
      .eq("template_name", "birthday-greeting")
      .gte("created_at", `${today.slice(0, 4)}-01-01`)
      .limit(2000);
    const sentAt = new Map<string, string>();
    for (const s of sent ?? []) {
      const k = (s.metadata as any)?.birthday_key as string | undefined;
      if (k && !sentAt.has(k)) sentAt.set(k, s.created_at as string);
    }
    return list.map((b) => {
      const key = keyOf(b.membershipId, b.rolle, b.vorname);
      return {
        key,
        membershipId: b.membershipId,
        name: `${b.vorname} ${b.nachname}`.trim(),
        rolle: b.rolle,
        tag: b.tag,
        inTagen: b.inTagen,
        wirdAlt: b.wirdAlt,
        hasEmail: !!b.email,
        sentAt: sentAt.get(key) ?? null,
      };
    });
  });

/** Glückwunsch per Mail – Empfänger wird serverseitig aus der Mitgliedschaft bestimmt. */
export const sendBirthdayGreeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ key: z.string().min(10).max(300) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const membershipId = data.key.split("|")[0] ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(membershipId)) throw new Error("Ungültige Auswahl.");
    const { todayBerlinIso } = await import("@/lib/format");
    const today = todayBerlinIso();
    const m = (await loadMemberships()).find((x) => x.id === membershipId);
    if (!m || !activeOn(m, today))
      throw new Error("Mitgliedschaft nicht gefunden oder nicht aktiv.");
    const p = (await birthdayWindow(personsOf(m))).find(
      (b) => keyOf(b.membershipId, b.rolle, b.vorname) === data.key,
    );
    if (!p) throw new Error("Kein Geburtstag in diesem Zeitraum gefunden.");
    if (p.inTagen > 0) throw new Error("Gratulieren geht ab dem Geburtstag.");
    if (!p.email) throw new Error("Für dieses Mitglied ist keine E-Mail-Adresse hinterlegt.");
    const child = p.rolle === "Kind" || (ageOn(p.geburtsdatum, p.tag) ?? 99) < 16;
    const { queueTemplateEmail } = await import("@/lib/email-send.server");
    const res = await queueTemplateEmail({
      templateName: "birthday-greeting",
      recipientEmail: p.email,
      templateData: {
        first_name: p.vorname,
        child,
        age: child ? p.wirdAlt : null,
        family: child ? `Familie ${m.last_name ?? p.nachname}`.trim() : null,
      },
      // Pro Person und Jahr höchstens einmal
      idempotencyKey: `birthday-${data.key}-${p.tag.slice(0, 4)}`,
      senderUserId: context.userId,
      metadata: { birthday_key: data.key },
    });
    if (!res.queued) throw new Error("Die Mail konnte nicht versendet werden.");
    await audit(context.userId, "birthday.greeting.sent", { membership_id: membershipId });
    return { ok: true as const };
  });

/** Abnahmetermine ohne Kurs (für das Protokoll „Abnahme ohne Kursbuchung“). */
export const listExternalExamDays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<Array<{ date: string; location: string | null; count: number }>> => {
      await assertStaff(context);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await (supabaseAdmin as any)
        .from("external_badge_exams")
        .select("exam_date,location")
        .is("course_id", null)
        .order("exam_date", { ascending: false })
        .limit(2000);
      if (error) throw new Error(error.message);
      const map = new Map<string, { date: string; location: string | null; count: number }>();
      for (const r of data ?? []) {
        const k = `${r.exam_date}|${r.location ?? ""}`;
        const cur = map.get(k) ?? {
          date: r.exam_date as string,
          location: (r.location as string) ?? null,
          count: 0,
        };
        cur.count++;
        map.set(k, cur);
      }
      return [...map.values()];
    },
  );
