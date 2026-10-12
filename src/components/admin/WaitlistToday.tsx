import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AssignControl, useAssignmentContext } from "@/components/admin/AssignControl";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import { formatDateBerlin, formatDateTimeBerlin, todayBerlinIso } from "@/lib/format";
import { relatedProgramIds } from "@/lib/waitlist-programs";
import { checkFit } from "@/lib/swim-fit";
import type { listWaitlist } from "@/lib/waitlist.functions";

type Data = Awaited<ReturnType<typeof listWaitlist>>;
export type TodayEntry = Data["entries"][number];

export type TodayView = "waiting" | "offered" | "followup" | "declined" | "done" | "report";

/** Einzelbereich, der von einer Kachel geöffnet wird (statt der Kachelübersicht). */
export type TodayOnly =
  "fit" | "due" | "suggestions" | "expiring" | "followups" | "free" | "new" | "min";

/** Warum wartet ein Eintrag? aktuell / Voraussetzung nicht erfüllt / auf Elternwunsch später. */
export type WaitingKind = "now" | "unmet" | "later";

/** Letzte Aktion der Eltern an einem Wartelisten-Eintrag: Eintrag, Rückmeldung oder Online-Buchung. */
export function parentActionOf(e: TodayEntry): {
  at: string;
  what: string;
  detail: string | null;
} {
  const r = e as Record<string, unknown>;
  const lastNote =
    String(r["admin_notes"] ?? "")
      .split("\n")
      .map((l) => l.replace(/^\[[^\]]*\]\s*/, "").trim())
      .filter(Boolean)
      .pop() ?? null;
  let best = {
    at: e.created_at,
    what: "Auf die Warteliste eingetragen",
    detail: null as string | null,
  };
  const responded = r["responded_at"];
  if (
    typeof responded === "string" &&
    ["waiting", "removed", "accepted"].includes(e.status) &&
    responded > best.at
  )
    best = { at: responded, what: "Rückmeldung der Familie", detail: lastNote };
  if (e.booking?.online && e.booking.booked_at && e.booking.booked_at > best.at)
    best = { at: e.booking.booked_at, what: "Online gebucht", detail: null };
  return best;
}

export function waitingKindOf(e: TodayEntry, data: Data | undefined): WaitingKind {
  const af = (e as Record<string, unknown>)["available_from"] as string | null;
  if (af && af > todayBerlinIso()) return "later";
  const program = data?.programs.find((p) => p.id === e.program_id) ?? null;
  if (program && !checkFit(e.notes, program).ok) return "unmet";
  return "now";
}

const STATUS_WORD: Record<string, string> = {
  waiting: "wartend",
  offered: "Angebot offen",
  accepted: "gebucht",
  declined: "abgesagt",
  expired: "Frist abgelaufen",
  removed: "entfernt",
};

type Suggestion = { key: string; childName: string | null; email: string | null; total: number };

export function buildTodo(data: Data | undefined, assignee = "", rules?: { waitlist?: string }) {
  // Zuständigkeitsfilter gilt für Einträge der Anfrageliste (nicht für Sperrvorschläge und Kurse)
  const entries = (data?.entries ?? []).filter((e) => {
    // Ausdrückliche Zuweisung vor Standard-Zuständigkeit des Bereichs
    const who =
      ((e as Record<string, unknown>)["assigned_to"] as string | null) || rules?.waitlist || "";
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
  // Alle Eingänge der Woche, egal in welchem Status (z. B. sofort gebucht oder angeboten)
  const newEntries = entries
    .filter((e) => new Date(parentActionOf(e).at).getTime() >= weekAgo)
    .sort((a, b) => parentActionOf(b).at.localeCompare(parentActionOf(a).at));
  const todayLabel = formatDateBerlin(new Date().toISOString());
  const newToday = newEntries.filter(
    (e) => formatDateBerlin(parentActionOf(e).at) === todayLabel,
  );
  // Weitere Aktionen der Eltern: Kursanfragen, Nachrichten, Mitgliedsanträge, Volljährigkeits-Bestätigungen
  const newOther = (data?.activity ?? []).filter((a) => new Date(a.at).getTime() >= weekAgo);
  const newOtherToday = newOther.filter((a) => formatDateBerlin(a.at) === todayLabel);
  // Direktbuchungen über die Website (kein Wartelisten-Eintrag), nicht vom Zuständigkeitsfilter betroffen
  const newDirect = (data?.directBookings ?? []).filter(
    (b) => new Date(b.created_at).getTime() >= weekAgo,
  );
  const newDirectToday = newDirect.filter((b) => formatDateBerlin(b.created_at) === todayLabel);
  const newUnassigned = newEntries.filter(
    (e) => !((e as Record<string, unknown>)["assigned_to"] || rules?.waitlist),
  );
  const waitNow: TodayEntry[] = [];
  const waitUnmet: TodayEntry[] = [];
  const waitLater: TodayEntry[] = [];
  for (const e of waiting) {
    const k = waitingKindOf(e, data);
    (k === "later" ? waitLater : k === "unmet" ? waitUnmet : waitNow).push(e);
  }
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

  // Kurse, die noch starten und die Mindestteilnehmerzahl (noch) nicht erreicht haben
  const minCourses = courses
    .filter(
      (c) =>
        c.min_participants != null &&
        c.status !== "completed" &&
        (!c.starts_on || c.starts_on >= todayIso) &&
        c.confirmed < c.min_participants,
    )
    .sort((a, b) => String(a.starts_on ?? "9999").localeCompare(String(b.starts_on ?? "9999")));
  const suggestions = [...suggestionMap.values()];
  return {
    suggestions,
    expiringOffers,
    followups,
    freeCourses,
    minCourses,
    newEntries,
    newToday,
    newDirect,
    newDirectToday,
    newOther,
    newOtherToday,
    newUnassigned,
    waitNow,
    waitUnmet,
    waitLater,
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
  initialMine,
  only,
  onOnly,
  onWaitingKind,
  onGuide,
  counts,
}: {
  /** Zählungen der Detailreiter für die Kacheln */
  counts: { offered: number; followup: number; declined: number; done: number };
  /** Geöffneter Einzelbereich; null = Kachelübersicht */
  only: TodayOnly | null;
  onOnly: (o: TodayOnly | null) => void;
  /** Öffnet „Wartend“ gefiltert nach Grund des Wartens */
  onWaitingKind: (k: WaitingKind) => void;
  onGuide: () => void;
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
  /** Mit ?zustaendig=ich geöffnet: Filter „Zuständig“ auf die angemeldete Person */
  initialMine?: boolean;
}) {
  const [assignee, setAssignee] = useState("");
  const [openCourse, setOpenCourse] = useState<string | null>(null);
  const ctx = useAssignmentContext();
  useEffect(() => {
    if (initialMine && ctx.data?.me) setAssignee(ctx.data.me);
  }, [initialMine, ctx.data?.me]);
  const qc = useQueryClient();
  // Wofür der Eintrag gilt: angebotener Kurs, sonst das gewünschte Angebot (Programm)
  const entryTarget = (e: TodayEntry) => {
    const offerId = (e as Record<string, unknown>)["offer_course_id"];
    const offered = offerId ? data?.courses.find((c) => c.id === offerId)?.name : null;
    return offered ?? data?.programs.find((p) => p.id === e.program_id)?.name ?? "ohne Zuordnung";
  };
  const t = buildTodo(data, assignee, ctx.data?.rules);
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
      <AssignControl
        kind="waitlist"
        id={e.id}
        area="waitlist"
        current={(e as Record<string, unknown>)["assigned_to"] as string | null}
        label={`Anfrageliste – ${e.child_name}`}
        onDone={() => qc.invalidateQueries({ queryKey: ["admin-waitlist"] })}
      />
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
          {(ctx.data?.staff ?? data?.staff ?? []).map((n) => (
            <option key={n} value={n}>
              {n}
              {n === ctx.data?.me ? " (ich)" : ""}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" className="h-8" onClick={onGuide}>
          Leitfaden
        </Button>
        {only && (
          <Button size="sm" variant="ghost" className="h-8" onClick={() => onOnly(null)}>
            ← Zurück zur Übersicht
          </Button>
        )}
      </div>

      {!only && (
        <div className="space-y-5">
          <TileRow title="Eingang · neu in den letzten 7 Tagen">
            <Tile
              n={t.newEntries.length + t.newDirect.length + t.newOther.length}
              label="Aktionen der Eltern"
              hint={
                t.newToday.length + t.newDirectToday.length + t.newOtherToday.length > 0
                  ? `heute: ${[...t.newToday, ...t.newDirectToday, ...t.newOtherToday]
                      .map((e) => ("name" in e ? e.name : e.child_name))
                      .join(", ")}`
                  : "heute noch nichts"
              }
              tone={
                t.newToday.length + t.newDirectToday.length + t.newOtherToday.length > 0
                  ? "warn"
                  : "normal"
              }
              action="Öffnen"
              onClick={() => onOnly("new")}
            />
            <Tile
              n={t.newUnassigned.length}
              label="Davon nicht zugewiesen"
              hint="noch niemand zuständig"
              tone={t.newUnassigned.length > 0 ? "warn" : "normal"}
              action="Zuweisen"
              onClick={() => onOnly("new")}
            />
          </TileRow>

          <TileRow title="Wartend · wer wartet warum">
            <Tile
              n={t.waitNow.length}
              label="Wartet auf einen Platz"
              hint="Niveau und Wunsch passen"
              action="Öffnen"
              onClick={() => onWaitingKind("now")}
            />
            <Tile
              n={t.waitUnmet.length}
              label="Voraussetzung nicht erfüllt"
              hint="Niveau oder Wunschtag passt nicht"
              tone={t.waitUnmet.length > 0 ? "warn" : "normal"}
              action="Prüfen"
              onClick={() => onWaitingKind("unmet")}
            />
            <Tile
              n={t.waitLater.length}
              label="Später gewünscht"
              hint="auf Elternwunsch ab einem Datum"
              action="Öffnen"
              onClick={() => onWaitingKind("later")}
            />
          </TileRow>

          <TileRow title="Angebote und Fristen">
            <Tile
              n={t.expiringOffers.length}
              label="Laufen in 48 Std. ab"
              hint="Absage erfassen oder abwarten"
              tone={t.expiringOffers.length > 0 ? "urgent" : "normal"}
              action="Öffnen"
              onClick={() => onOnly("expiring")}
            />
            <Tile
              n={counts.offered}
              label="Angebote offen"
              hint="Antwort der Eltern steht aus"
              action="Öffnen"
              onClick={() => onGoto("offered")}
            />
            <Tile
              n={counts.followup}
              label="Rückfrage offen"
              hint="„Warteliste behalten?“"
              tone={counts.followup > 0 ? "warn" : "normal"}
              action="Öffnen"
              onClick={() => onGoto("followup")}
            />
            <Tile
              n={t.dueFollowUps.length}
              label="Wiedervorlage fällig"
              hint="heute nachfassen"
              tone={t.dueFollowUps.length > 0 ? "urgent" : "normal"}
              action="Öffnen"
              onClick={() => onOnly("due")}
            />
          </TileRow>

          <TileRow title="Plätze und Kurse">
            <Tile
              n={t.freeCourses.length}
              label="Freie Plätze mit Familien"
              hint={
                t.freeCourses.length > 0
                  ? t.freeCourses
                      .slice(0, 3)
                      .map(
                        (x) =>
                          `${x.course.name.replace(/^Schwimmabzeichen /, "")} ${x.course.free}`,
                      )
                      .join(" · ")
                  : "keine passenden Familien"
              }
              tone={t.freeCourses.length > 0 ? "warn" : "normal"}
              action="Plätze vergeben"
              onClick={() => onOnly("free")}
            />
            <Tile
              n={t.fitChecks.length}
              label="Passt das? Manuell prüfen"
              hint="freier Platz, aber nichts passt automatisch"
              tone={t.fitChecks.length > 0 ? "urgent" : "normal"}
              action="Prüfen"
              onClick={() => onOnly("fit")}
            />
            <Tile
              n={t.minCourses.length}
              label="Mindestzahl nicht erreicht"
              hint={
                t.minCourses.length > 0
                  ? t.minCourses
                      .slice(0, 2)
                      .map(
                        (c) =>
                          `${c.name.replace(/^Schwimmabzeichen /, "")} ${c.confirmed}/${c.min_participants}`,
                      )
                      .join(" · ")
                  : "alle Kurse über der Mindestzahl"
              }
              tone={t.minCourses.length > 0 ? "warn" : "normal"}
              action="Öffnen"
              onClick={() => onOnly("min")}
            />
            <Tile
              n={null}
              label="Nachfrage je Angebot"
              hint="wo ein zusätzlicher Kurs lohnt"
              action="Öffnen"
              onClick={() => onGoto("report")}
            />
          </TileRow>

          <TileRow title="Klärung und Verlauf">
            <Tile
              n={t.suggestions.length}
              label="Sperrliste prüfen"
              hint="ab 3 Absagen oder Stornos"
              tone={t.suggestions.length > 0 ? "urgent" : "normal"}
              action="Öffnen"
              onClick={() => onOnly("suggestions")}
            />
            <Tile
              n={counts.declined}
              label="Absagen und Stornos"
              hint="zum Nachhalten"
              action="Öffnen"
              onClick={() => onGoto("declined")}
            />
            <Tile
              n={counts.done}
              label="Archiv"
              hint="erledigte Einträge"
              action="Öffnen"
              onClick={() => onGoto("done")}
            />
          </TileRow>
        </div>
      )}

      {only === "new" && (
        <Section
          title="Aktionen der Eltern in den letzten 7 Tagen"
          count={t.newEntries.length + t.newDirect.length + t.newOther.length}
        >
          {t.newEntries.length + t.newDirect.length + t.newOther.length === 0 && (
            <li className="py-2 text-muted-foreground">
              Keine Aktionen der Eltern in den letzten 7 Tagen.
            </li>
          )}
          {[
            ...t.newDirect.map((b) => ({ at: b.created_at, kind: "direct" as const, b })),
            ...t.newEntries.map((e) => ({ at: parentActionOf(e).at, kind: "entry" as const, e })),
            ...t.newOther.map((a) => ({ at: a.at, kind: "other" as const, a })),
          ]
            .sort((x, y) => y.at.localeCompare(x.at))
            .map((item) => {
              if (item.kind === "direct") {
                const b = item.b;
                return (
                  <li
                    key={`d-${b.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {b.request_id ? (
                        <Link
                          to="/admin/archiv"
                          search={{ anfrage: b.request_id }}
                          className="font-medium text-primary underline underline-offset-2"
                        >
                          {b.child_name}
                        </Link>
                      ) : (
                        <span className="font-medium">{b.child_name}</span>
                      )}
                      <Link
                        to="/admin/familie"
                        search={{ email: b.parent_email ?? "" }}
                        className="text-xs text-muted-foreground underline"
                      >
                        Familie
                      </Link>
                      <span className="text-muted-foreground">{b.parent_email}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">
                        {b.status === "confirmed" ? "Online gebucht" : b.status} · {b.course_name}
                      </Badge>
                      {formatDateTimeBerlin(b.created_at)}
                    </span>
                  </li>
                );
              }
              if (item.kind === "entry") {
                const e = item.e;
                const act = parentActionOf(e);
                return (
                  <li
                    key={`e-${e.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span>
                      {nameBtn(e)} <span className="text-muted-foreground">{e.parent_email}</span>
                      {act.detail && (
                        <span className="block text-xs text-muted-foreground">{act.detail}</span>
                      )}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant="secondary"
                        title={`${act.what} · Stand jetzt: ${STATUS_WORD[e.status] ?? e.status}`}
                      >
                        {act.what} · {entryTarget(e)}
                      </Badge>
                      <Badge variant="outline">{STATUS_WORD[e.status] ?? e.status}</Badge>
                      <span title={`Eingegangen ${formatDateBerlin(e.created_at)}`}>
                        {formatDateTimeBerlin(act.at)}
                      </span>
                    </span>
                  </li>
                );
              }
              const a = item.a;
              const label = {
                request: "Kursanfrage",
                message: "Nachricht",
                membership: "Mitgliedsantrag",
                majority: "Volljährigkeit bestätigt",
              }[a.kind];
              const linkClass = "font-medium text-primary underline underline-offset-2";
              return (
                <li
                  key={`o-${a.kind}-${a.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {a.kind === "request" ? (
                      <Link to="/admin/archiv" search={{ anfrage: a.id }} className={linkClass}>
                        {a.name}
                      </Link>
                    ) : a.kind === "message" ? (
                      <Link to="/admin/nachrichten" className={linkClass}>
                        {a.name}
                      </Link>
                    ) : (
                      <Link to="/admin/mitglieder" className={linkClass}>
                        {a.name}
                      </Link>
                    )}
                    {a.email && (
                      <Link
                        to="/admin/familie"
                        search={{ email: a.email }}
                        className="text-xs text-muted-foreground underline"
                      >
                        Familie
                      </Link>
                    )}
                    <span className="text-muted-foreground">{a.email}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">
                      {label}
                      {a.detail ? ` · ${a.detail}` : ""}
                    </Badge>
                    {formatDateTimeBerlin(a.at)}
                  </span>
                </li>
              );
            })}
        </Section>
      )}

      {only === "fit" && t.fitChecks.length === 0 && <EmptyOnly />}
      {only === "due" && t.dueFollowUps.length === 0 && <EmptyOnly />}
      {only === "suggestions" && t.suggestions.length === 0 && <EmptyOnly />}
      {only === "expiring" && t.expiringOffers.length === 0 && <EmptyOnly />}
      {only === "followups" && t.followups.length === 0 && <EmptyOnly />}
      {only === "free" && t.freeCourses.length === 0 && <EmptyOnly />}
      {only === "min" && t.minCourses.length === 0 && <EmptyOnly />}
      {only === "min" && t.minCourses.length > 0 && (
        <Section title="Mindestzahl nicht erreicht" count={t.minCourses.length}>
          {t.minCourses.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">
                  {c.starts_on ? ` · Start ${formatDateBerlin(c.starts_on)}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">
                  {c.confirmed} von mindestens {c.min_participants} gebucht
                </Badge>
                {c.held > 0 ? `${c.held} Angebot(e) offen` : ""}
              </span>
            </li>
          ))}
        </Section>
      )}

      {only === "fit" && t.fitChecks.length > 0 && (
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

      {only === "due" && t.dueFollowUps.length > 0 && (
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

      {only === "suggestions" && t.suggestions.length > 0 && (
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

      {only === "expiring" && t.expiringOffers.length > 0 && (
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

      {only === "followups" && t.followups.length > 0 && (
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

      {only === "free" && t.freeCourses.length > 0 && (
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

function TileRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

/** Kachel der Übersicht: Zahl, Titel, ein erklärender Satz und die Aktion. */
function Tile({
  n,
  label,
  hint,
  action,
  onClick,
  tone = "normal",
}: {
  n: number | null;
  label: string;
  hint: string;
  action: string;
  onClick: () => void;
  tone?: "normal" | "warn" | "urgent";
}) {
  const border =
    tone === "urgent"
      ? "border-red-300 bg-red-50"
      : tone === "warn"
        ? "border-amber-300 bg-amber-50"
        : "bg-card";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[112px] flex-col gap-0.5 rounded-lg border p-4 text-left transition hover:shadow-soft ${border} ${
        n === 0 ? "opacity-60" : ""
      }`}
    >
      {n != null && <span className="text-3xl font-semibold leading-tight">{n}</span>}
      <span className="text-sm font-semibold text-primary-deep">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      <span className="mt-auto pt-2 text-xs text-primary">{action} →</span>
    </button>
  );
}

function EmptyOnly() {
  return (
    <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
      Hier ist gerade nichts zu tun.
    </div>
  );
}
