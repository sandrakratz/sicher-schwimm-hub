import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw } from "lucide-react";
import { formatDateBerlin } from "@/lib/format";
import { relatedProgramIds } from "@/lib/waitlist-programs";
import type { listWaitlist } from "@/lib/waitlist.functions";

type Data = Awaited<ReturnType<typeof listWaitlist>>;
export type TodayEntry = Data["entries"][number];

export type TodayView = "waiting" | "offered" | "followup" | "declined" | "done";

type Suggestion = { key: string; childName: string | null; email: string | null; total: number };

export function buildTodo(data: Data | undefined) {
  const entries = data?.entries ?? [];
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
        const fits = !e.program_id || relatedProgramIds(c.program_id, programs).includes(e.program_id);
        const af = (e as Record<string, unknown>)["available_from"] as string | null;
        const timely = !af || !c.starts_on || c.starts_on >= af;
        return fits && timely;
      });
      return { course: c, waiting: candidates.length };
    })
    .filter((x) => x.waiting > 0);

  const weekAgo = now - 7 * 24 * 3600 * 1000;
  const newEntries = waiting.filter((e) => new Date(e.created_at).getTime() >= weekAgo);

  const suggestions = [...suggestionMap.values()];
  return {
    suggestions,
    expiringOffers,
    followups,
    freeCourses,
    newEntries,
    count: suggestions.length + expiringOffers.length + followups.length + freeCourses.length,
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
}) {
  const t = buildTodo(data);
  const nameBtn = (e: TodayEntry) => (
    <button
      type="button"
      className="font-medium text-primary underline underline-offset-2"
      onClick={() => onOpenDetail(e)}
    >
      {e.child_name}
    </button>
  );

  if (t.count === 0 && t.newEntries.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Heute ist nichts zu tun. Alle Angebote, Rückfragen und Sperrvorschläge sind erledigt.
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
                <span className="font-medium">{s.childName ?? "–"}</span>{" "}
                <span className="text-muted-foreground">{s.email}</span>{" "}
                <Badge variant="secondary" className="bg-red-100 text-red-900">
                  {s.total}×
                </Badge>
              </span>
              <span className="flex gap-3 text-xs">
                <button
                  type="button"
                  className="text-red-900 underline"
                  onClick={() => onBlock(s)}
                >
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
                  {courseName(e.offer_course_id)} · Frist {formatDateBerlin(String(e.offer_expires_at))}
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
          {t.freeCourses.map(({ course, waiting }) => (
            <li key={course.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="font-medium">{course.name}</span>
              <span className="text-muted-foreground">
                {course.free} frei · {waiting} passende Familie(n) wartend
              </span>
            </li>
          ))}
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
