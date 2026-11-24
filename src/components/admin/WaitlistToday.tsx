import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useAssignmentContext } from "@/components/admin/AssignControl";
import { formatDateBerlin } from "@/lib/format";
import { meetsMinAge } from "@/lib/waitlist-age";
import {
  buildTodo,
  programOf,
  type TodayOnly,
  type TodayView,
  type WaitingKind,
  type WaitlistData,
  type WaitlistEntry,
} from "@/components/admin/warteliste/logic";
import type { WaitlistMutations } from "@/components/admin/warteliste/useWaitlistMutations";
import { confirmTooYoung } from "@/components/admin/warteliste/confirm";
import {
  AllocateButton,
  EmptyOnly,
  EntryName,
  Item,
  Section,
  SuggestionActions,
} from "@/components/admin/warteliste/ui";
import { TodayOverview } from "@/components/admin/warteliste/TodayOverview";
import { ParentActivity } from "@/components/admin/warteliste/ParentActivity";

type ListOnly = Exclude<TodayOnly, "new">;

/** Reiter „Übersicht“ der Anfrageliste: Kacheln mit dem, was heute zu tun ist, und deren Listen. */
export function WaitlistToday({
  data,
  m,
  courseName,
  onGoto,
  onOpenDetail,
  onDeclineOffer,
  initialMine,
  only,
  onOnly,
  onWaitingKind,
  onGuide,
  counts,
  embedded = false,
}: {
  /** Im Eingang eingebettet: ohne Leitfaden und ohne „Zurück zur Übersicht“ */
  embedded?: boolean;
  data: WaitlistData | undefined;
  m: WaitlistMutations;
  courseName: (id: unknown) => string;
  /** Zählungen der Detailreiter für die Kacheln */
  counts: { offered: number; followup: number; declined: number; done: number };
  /** Geöffneter Einzelbereich; null = Kachelübersicht */
  only: TodayOnly | null;
  onOnly: (o: TodayOnly | null) => void;
  /** Öffnet „Wartend“ gefiltert nach Grund des Wartens */
  onWaitingKind: (k: WaitingKind) => void;
  onGuide: () => void;
  onGoto: (v: TodayView) => void;
  onOpenDetail: (e: WaitlistEntry) => void;
  onDeclineOffer: (e: WaitlistEntry) => void;
  /** Mit ?zustaendig=ich geöffnet: Filter „Zuständig“ auf die angemeldete Person */
  initialMine?: boolean;
}) {
  const ctx = useAssignmentContext();
  // null = noch nichts gewählt: dann „Alle“ bzw. bei ?zustaendig=ich die angemeldete Person
  const [picked, setPicked] = useState<string | null>(null);
  const assignee = picked ?? (initialMine ? (ctx.data?.me ?? "") : "");
  const [openCourse, setOpenCourse] = useState<string | null>(null);
  const t = buildTodo(data, assignee, ctx.data?.rules);
  const courses = data?.courses ?? [];
  const programs = data?.programs ?? [];
  const name = (e: WaitlistEntry) => <EntryName e={e} onOpen={onOpenDetail} />;

  // Wofür der Eintrag gilt: angebotener Kurs, sonst das gewünschte Angebot (Programm)
  const entryTarget = (e: WaitlistEntry) =>
    (e.offer_course_id ? courses.find((c) => c.id === e.offer_course_id)?.name : null) ??
    programOf(programs, e.program_id)?.name ??
    "ohne Zuordnung";

  const offer = (e: WaitlistEntry, courseId: string) => {
    const c = courses.find((x) => x.id === courseId);
    if (!c) return;
    const minAge = programOf(programs, c.program_id)?.min_age_years ?? null;
    if (!meetsMinAge(e.child_dob, c.starts_on, minAge) && !confirmTooYoung(e)) return;
    if (
      !confirm(
        `${e.child_name} einen Platz in „${c.name}“ anbieten? Die Eltern erhalten eine E-Mail mit Zusage-Link.`,
      )
    )
      return;
    m.offer.mutate({ entryId: e.id, courseId });
  };

  const listOf: Record<ListOnly, unknown[]> = {
    fit: t.fitChecks,
    due: t.dueFollowUps,
    suggestions: t.suggestions,
    expiring: t.expiringOffers,
    free: t.freeCourses,
    min: t.minCourses,
  };
  const show = (o: ListOnly) => only === o && listOf[o].length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="text-muted-foreground" htmlFor="today-assignee">
          Zuständig:
        </label>
        <NativeSelect
          id="today-assignee"
          size="sm"
          value={assignee}
          onChange={(ev) => setPicked(ev.target.value)}
        >
          <option value="">Alle</option>
          <option value="__none">Nicht zugewiesen</option>
          {(ctx.data?.staff ?? data?.staff ?? []).map((n) => (
            <option key={n} value={n}>
              {n}
              {n === ctx.data?.me ? " (ich)" : ""}
            </option>
          ))}
        </NativeSelect>
        {!embedded && (
          <Button size="sm" variant="outline" className="h-8" onClick={onGuide}>
            Leitfaden
          </Button>
        )}
        {only && !embedded && (
          <Button size="sm" variant="ghost" className="h-8" onClick={() => onOnly(null)}>
            ← Zurück zur Übersicht
          </Button>
        )}
      </div>

      {!only && (
        <TodayOverview
          t={t}
          counts={counts}
          onOnly={onOnly}
          onGoto={onGoto}
          onWaitingKind={onWaitingKind}
        />
      )}

      {only === "new" && (
        <ParentActivity t={t} entryTarget={entryTarget} onOpenDetail={onOpenDetail} />
      )}

      {only && only !== "new" && listOf[only].length === 0 && <EmptyOnly />}

      {show("min") && (
        <Section title="Mindestzahl nicht erreicht" count={t.minCourses.length}>
          {t.minCourses.map((c) => (
            <Item key={c.id}>
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
            </Item>
          ))}
        </Section>
      )}

      {show("fit") && (
        <Section
          title="Passt das? – manuell prüfen"
          count={t.fitChecks.length}
          tone="urgent"
          onAll={() => onGoto("waiting")}
        >
          {t.fitChecks.map(({ e, issues }) => (
            <li key={e.id} className="py-2">
              <div>{name(e)}</div>
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

      {show("due") && (
        <Section
          title="Wiedervorlage fällig"
          count={t.dueFollowUps.length}
          tone="urgent"
          onAll={() => onGoto("waiting")}
        >
          {t.dueFollowUps.map((e) => (
            <Item key={e.id}>
              <span>
                {name(e)}{" "}
                <span className="text-muted-foreground">
                  {e.assigned_to ? `→ ${e.assigned_to}` : "nicht zugewiesen"}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                seit {formatDateBerlin(e.follow_up_on)}
              </span>
            </Item>
          ))}
        </Section>
      )}

      {show("suggestions") && (
        <Section
          title="Sperrliste prüfen (ab 3 Absagen/Stornierungen)"
          count={t.suggestions.length}
          tone="urgent"
          onAll={() => onGoto("declined")}
        >
          {t.suggestions.map((s) => (
            <Item key={s.key}>
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
                <SuggestionActions
                  onBlock={() => m.blockSuggested(s, "Anfrageliste")}
                  onDismiss={() => m.dismissSuggested(s)}
                />
              </span>
            </Item>
          ))}
        </Section>
      )}

      {show("expiring") && (
        <Section
          title="Angebote laufen in 48 Std. ab"
          count={t.expiringOffers.length}
          tone="urgent"
          onAll={() => onGoto("offered")}
        >
          {t.expiringOffers.map((e) => (
            <Item key={e.id}>
              <span>
                {name(e)}{" "}
                <span className="text-muted-foreground">
                  {courseName(e.offer_course_id)} · Frist {formatDateBerlin(e.offer_expires_at)}
                </span>
              </span>
              <Button size="sm" variant="outline" onClick={() => onDeclineOffer(e)}>
                Absage erfassen
              </Button>
            </Item>
          ))}
        </Section>
      )}

      {show("free") && (
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
                          {name(e)}{" "}
                          <span className="text-muted-foreground">
                            {e.parent_name}
                            {e.is_member ? " · Mitglied" : ""} · wartet seit{" "}
                            {formatDateBerlin(e.created_at)}
                          </span>
                        </span>
                        <Button
                          size="sm"
                          onClick={() => offer(e, course.id)}
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
            <AllocateButton onClick={() => m.allocate.mutate()} pending={m.allocate.isPending} />
          </li>
        </Section>
      )}
    </div>
  );
}
