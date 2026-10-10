import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import { formatDateBerlin } from "@/lib/format";
import { relatedProgramIds } from "@/lib/waitlist-programs";
import { checkFit } from "@/lib/swim-fit";
import type { listWaitlist } from "@/lib/waitlist.functions";

type Data = Awaited<ReturnType<typeof listWaitlist>>;
export type TodayEntry = Data["entries"][number];

export type TodayView = "waiting" | "offered" | "followup" | "declined" | "done";

type Suggestion = { key: string; childName: string | null; email: string | null; total: number };

export function buildTodo(data: Data | undefined, assignee = "") {
  // Zuständigkeitsfilter gilt für Einträge der Anfrageliste (nicht für Sperrvorschläge und Kurse)
  const entries = (data?.entries ?? []).filter((e) => {
    const who = ((e as Record<string, unknown>)["assigned_to"] as string | null) ?? "";
    return assignee === "" ? true : assignee === "__none" ? !who : who === assignee;
  });
  const todayIso = new Date().toISOString().slice(0, 10);
  const courses = data?.courses ?? [];
  const programs = data?.programs ?? [];
  const now = Date.now();
  const in48h = now + 48 * 3600 * 1000;

  const suggestionMap = new Map<string, Suggestion>();
  const addSuggestion = (childName: string | null, email: string | null, total: number) => {
    const key = (email ?? childName ?? "").trim().toLowerCase();
    if (!key) return;
    const prev = suggestionMap.get(key);
    if (!prev || prev.total < total) suggestionMap.set(key, { key, childName, email, total });
  };
  for (const e of entries) {
    if (e.block_suggestion && Number((e as Record<string, unknown>)["decline_count"] ?? 0) > 0)
      addSuggestion(e.child_name, e.parent_email, e.declines_total);
  }
  for (const c of data?.cancellations ?? []) {
    if (c.block_suggestion) addSuggestion(c.child_name, c.parent_email, c.declines_total);
  }

  const expiringOffers = entries
    .filter(
      (e) =>
        e.status === "offered" &&
        !!e.offer_expires_at &&
        new Date(e.offer_expires_at).getTime() < in48h,
    )
    .sort((a, b) => String(a.offer_expires_at).localeCompare(String(b.offer_expires_at)));

  const followups = entries
    .filter((e) => ["declined", "expired"].includes(e.status))
    .sort((a, b) =>
      String((a as Record<string, unknown>)["followup_expires_at"] ?? "").localeCompare(
        String((b as Record<string, unknown>)["followup_expires_at"] ?? ""),
      ),
    );

  const waiting = entries.filter((e) => e.status === "waiting");
  const freeCourses = courses
    .filter((c) => c.free != null && c.free > 0)
    .map((c) => {
      const candidates = waiting.filter((e) => {
        const fits =
          !e.program_id || relatedProgramIds(c.program_id, programs).includes(e.program_id);
        const af = (e as Record<string, unknown>)["available_from"] as string | null;
        const timely = !af || !c.starts_on || c.starts_on >= af;
        const fitsLevel = checkFit(e.notes, programs.find((p) => p.id === c.program_id) ?? null).ok;
        return fits && timely && fitsLevel;
      });
      const families = [...candidates].sort(
        (a, b) =>
          Number(b.is_member === true) - Number(a.is_member === true) ||
          a.created_at.localeCompare(b.created_at),
      );
      return { course: c, waiting: candidates.length, families };
    })
    .filter((x) => x.waiting > 0);

  const weekAgo = now - 7 * 24 * 3600 * 1000;
  const newEntries = waiting.filter((e) => new Date(e.created_at).getTime() >= weekAgo);
  const fitChecks = waiting
    .map((e) => ({ e, issues: fitProblems(e, data) }))
    .filter((x): x is { e: TodayEntry; issues: string[] } => !!x.issues);
  const dueFollowUps = entries
    .filter((e) => {
      const fu = (e as Record<string, unknown>)["follow_up_on"] as string | null;
      return !!fu && fu <= todayIso && !["removed", "accepted"].includes(e.status);
    })
    .sort((a, b) =>
      String((a as Record<string, unknown>)["follow_up_on"]).localeCompare(
        String((b as Record<string, unknown>)["follow_up_on"]),
      ),
    );

  const suggestions = [...suggestionMap.values()];
  return {
    suggestions,
    expiringOffers,
    followups,
    freeCourses,
    newEntries,
    dueFollowUps,
    fitChecks,
    count:
      suggestions.length +
      expiringOffers.length +
      followups.length +
      freeCourses.length +
      dueFollowUps.length +
      fitChecks.length,
  };
}

function Section({
  title,
  count,
  tone = "normal",
  onAll,
  children,
}: {
  title: string;
  count: number;
  tone?: "urgent" | "normal";
  onAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border p-4 ${tone === "urgent" ? "border-red-300 bg-red-50" : "bg-card"}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-semibold">
          {title} <span className="text-muted-foreground">({count})</span>
        </h3>
        {onAll && (
          <Button size="sm" variant="ghost" onClick={onAll}>
            Alle anzeigen
          </Button>
        )}
      </div>
      <ul className="divide-y text-sm">{children}</ul>
    </section>
  );
}

export function WaitlistToday({
  data,
  courseName,
  onGoto,
  onOpenDetail,
  onDeclineOffer,
  onAllocate,
  allocating,
  onBlock,
  onDismiss,
  onOffer,
}: {
  data: Data | undefined;
  courseName: (id: unknown) => string;
  onGoto: (v: TodayView) => void;
  onOpenDetail: (e: TodayEntry) => void;
  onDeclineOffer: (e: TodayEntry) => void;
  onAllocate: () => void;
  allocating: boolean;
  onBlock: (s: Suggestion) => void;
  onDismiss: (s: Suggestion) => void;
  onOffer: (e: TodayEntry, courseId: string) => void;
}) {
  const [assignee, setAssignee] = useState("");
  const [openCourse, setOpenCourse] = useState<string | null>(null);
  const t = buildTodo(data, assignee);
  const nameBtn = (e: TodayEntry) => (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="font-medium text-primary underline underline-offset-2"
        onClick={() => onOpenDetail(e)}
      >
        {e.child_name}
      </button>
      <Link
        to="/admin/familie"
        search={{ email: e.parent_email ?? "" }}
        className="text-xs text-muted-foreground underline"
      >
        Familie
      </Link>
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="text-muted-foreground" htmlFor="today-assignee">
          Zuständig:
        </label>
        <select
          id="today-assignee"
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          value={assignee}
          onChange={(ev) => setAssignee(ev.target.value)}
        >
          <option value="">Alle</option>
          <option value="__none">Nicht zugewiesen</option>
          {(data?.staff ?? []).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      {t.count === 0 && t.newEntries.length === 0 && (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Heute ist nichts zu tun. Alle Angebote, Rückfragen und Sperrvorschläge sind erledigt.
        </div>
      )}

      {t.fitChecks.length > 0 && (
        <Section
          title="Passt das? – manuell prüfen"
          count={t.fitChecks.length}
          tone="urgent"
          onAll={() => onGoto("waiting")}
        >
          {t.fitChecks.map(({ e, issues }) => (
            <li key={e.id} className="py-2">
              <div>{nameBtn(e)}</div>
              <ul className="ml-4 list-disc text-xs text-red-900">
                {issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <div className="mt-1 text-xs text-muted-foreground">
                Es gibt freie Plätze, aber keinen automatisch passenden. Bitte in „Wartend“ einen
                passenden Kurs anbieten oder die Familie anschreiben.
              </div>
            </li>
          ))}
        </Section>
      )}

      {t.dueFollowUps.length > 0 && (
        <Section
          title="Wiedervorlage fällig"
          count={t.dueFollowUps.length}
          tone="urgent"
          onAll={() => onGoto("waiting")}
        >
          {t.dueFollowUps.map((e) => {
            const rec = e as Record<string, unknown>;
            return (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {nameBtn(e)}{" "}
                  <span className="text-muted-foreground">
                    {rec["assigned_to"] ? `→ ${String(rec["assigned_to"])}` : "nicht zugewiesen"}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  seit {formatDateBerlin(String(rec["follow_up_on"]))}
                </span>
              </li>
            );
          })}
        </Section>
      )}

      {t.suggestions.length > 0 && (
        <Section
          title="Sperrliste prüfen (ab 3 Absagen/Stornierungen)"
          count={t.suggestions.length}
          tone="urgent"
          onAll={() => onGoto("declined")}
        >
          {t.suggestions.map((s) => (
            <li key={s.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <Link
                  to="/admin/familie"
                  search={s.email ? { email: s.email } : { name: s.childName ?? "" }}
                  className="font-medium text-primary underline underline-offset-2"
                  title="Familie öffnen: Verlauf, Absagen, Buchungen"
                >
                  {s.childName ?? "–"}
                </Link>
                <span className="text-muted-foreground">{s.email}</span>{" "}
                <Badge variant="secondary" className="bg-red-100 text-red-900">
                  {s.total}×
                </Badge>
              </span>
              <span className="flex gap-3 text-xs">
                <button type="button" className="text-red-900 underline" onClick={() => onBlock(s)}>
                  Sperren
                </button>
                <button
                  type="button"
                  className="text-muted-foreground underline"
                  onClick={() => onDismiss(s)}
                >
                  Ignorieren
                </button>
              </span>
            </li>
          ))}
        </Section>
      )}

      {t.expiringOffers.length > 0 && (
        <Section
          title="Angebote laufen in 48 Std. ab"
          count={t.expiringOffers.length}
          tone="urgent"
          onAll={() => onGoto("offered")}
        >
          {t.expiringOffers.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {nameBtn(e)}{" "}
                <span className="text-muted-foreground">
                  {courseName(e.offer_course_id)} · Frist{" "}
                  {formatDateBerlin(String(e.offer_expires_at))}
                </span>
              </span>
              <Button size="sm" variant="outline" onClick={() => onDeclineOffer(e)}>
                Absage erfassen
              </Button>
            </li>
          ))}
        </Section>
      )}

      {t.followups.length > 0 && (
        <Section
          title="Rückfrage „Warteliste behalten?“ offen"
          count={t.followups.length}
          onAll={() => onGoto("followup")}
        >
          {t.followups.map((e) => {
            const until = (e as Record<string, unknown>)["followup_expires_at"];
            return (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {nameBtn(e)} <span className="text-muted-foreground">{e.parent_email}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {until ? `Antwort bis ${formatDateBerlin(String(until))}` : "Frist offen"}
                </span>
              </li>
            );
          })}
        </Section>
      )}

      {t.freeCourses.length > 0 && (
        <Section
          title="Freie Plätze mit wartenden Familien"
          count={t.freeCourses.length}
          onAll={() => onGoto("waiting")}
        >
          {t.freeCourses.map(({ course, waiting, families }) => {
            const open = openCourse === course.id;
            return (
              <li key={course.id} className="py-2">
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center justify-between gap-2 text-left hover:text-primary"
                  onClick={() => setOpenCourse(open ? null : course.id)}
                  aria-expanded={open}
                >
                  <span className="flex items-center gap-1 font-medium">
                    {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {course.name}
                    {course.starts_on && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · Start {formatDateBerlin(course.starts_on)}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground underline underline-offset-2">
                    {course.free} frei · {waiting} passende Familie(n) wartend
                  </span>
                </button>
                {open && (
                  <ul className="mt-2 divide-y rounded-md border bg-muted/30">
                    {families.map((e) => (
                      <li
                        key={e.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                      >
                        <span>
                          {nameBtn(e)}{" "}
                          <span className="text-muted-foreground">
                            {e.parent_name}
                            {e.is_member ? " · Mitglied" : ""} · wartet seit{" "}
                            {formatDateBerlin(e.created_at)}
                          </span>
                        </span>
                        <Button
                          size="sm"
                          onClick={() => onOffer(e, course.id)}
                          title={`Platz in „${course.name}“ anbieten (Mail mit Zusage-Link)`}
                        >
                          Platz anbieten
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
          <li className="pt-3">
            <Button size="sm" onClick={onAllocate} disabled={allocating}>
              {allocating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Plätze jetzt vergeben
            </Button>
          </li>
        </Section>
      )}

      {t.newEntries.length > 0 && (
        <Section
          title="Neu in den letzten 7 Tagen"
          count={t.newEntries.length}
          onAll={() => onGoto("waiting")}
        >
          {t.newEntries.slice(0, 8).map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {nameBtn(e)} <span className="text-muted-foreground">{e.parent_email}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                eingegangen {formatDateBerlin(e.created_at)}
              </span>
            </li>
          ))}
        </Section>
      )}
    </div>
  );
}

/**
 * „Passt das?“: Gibt es für einen wartenden Eintrag freie Plätze, aber keiner davon besteht die
 * Prüfung (Niveau/Wunschtag)? Dann wird nie automatisch angeboten; die Gründe stehen hier.
 * `null` = nichts zu prüfen (kein freier Platz oder mindestens ein Kurs passt).
 */
export function fitProblems(e: TodayEntry, data: Data | undefined): string[] | null {
  if (e.status !== "waiting" || !data) return null;
  const today = new Date().toISOString().slice(0, 10);
  const af = (e as Record<string, unknown>)["available_from"] as string | null;
  const candidates = data.courses.filter((c) => {
    if (c.free == null || c.free <= 0) return false;
    if (c.starts_on && c.starts_on <= today) return false;
    if (af && c.starts_on && c.starts_on < af) return false;
    if (e.program_id && !relatedProgramIds(c.program_id, data.programs).includes(e.program_id))
      return false;
    return true;
  });
  if (candidates.length === 0) return null;
  const issues = new Set<string>();
  for (const c of candidates) {
    const program = data.programs.find((p) => p.id === c.program_id) ?? null;
    const fit = checkFit(e.notes, program);
    if (fit.ok) return null;
    fit.issues.forEach((i) => issues.add(i));
  }
  return [...issues];
}
