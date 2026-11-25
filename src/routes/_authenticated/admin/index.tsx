import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listWaitlist } from "@/lib/waitlist.functions";
import { buildTodo } from "@/components/admin/warteliste/logic";
import { WAITLIST_QUERY_KEY } from "@/components/admin/warteliste/useWaitlistMutations";
import { useAssignmentContext } from "@/components/admin/AssignControl";
import { BirthdaysPanel, useBirthdays } from "@/components/admin/eingang/BirthdaysPanel";
import { OpenAvailabilityNotice } from "@/components/OpenAvailabilityNotice";
import { MemberCheckPanel } from "@/components/admin/MemberCheckPanel";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Cake,
  CalendarCheck,
  CheckCircle2,
  Euro,
  Hourglass,
  ListChecks,
  MailOpen,
  ShieldCheck,
  UserRound,
  Users,
  Waves,
} from "lucide-react";
import { assertHasAnyRole } from "@/lib/role-guard";
import { getAdminTasks, type AdminTask } from "@/lib/admin-dashboard.functions";
import { getMyAssignments, type MyAssignments } from "@/lib/my-assignments.functions";
import {
  CourseRequestsPanel,
  FamilySwimPanel,
  GapsPanel,
  MembershipsPanel,
  MessagesPanel,
  PaymentsPanel,
  WaitlistPanel,
} from "@/components/admin/eingang/InboxPanels";

export const Route = createFileRoute("/_authenticated/admin/")({
  beforeLoad: async () => {
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board"] } });
    } catch {
      throw redirect({ to: "/admin/benutzer" });
    }
  },
  component: Eingang,
});

/** Ein Eintrag im Eingang: eine offene Aufgabe aus dem Dashboard oder etwas, das mir zugewiesen ist. */
type InboxEntry = {
  id: string;
  /** info = Hinweis ohne Pflicht (zählt nicht zu „offen“) */
  group: "mine" | "task" | "info";
  label: string;
  count: number;
  hint?: string;
  to: string;
  search?: Record<string, string>;
  tone: AdminTask["tone"] | "mine";
  icon: typeof Euro;
  /** Was ist hier zu tun? Ein Satz für die rechte Seite. */
  todo: string;
  /** Wie heißt der Knopf, der zur Bearbeitung führt? */
  action: string;
};

const TASK_ICON: Record<string, typeof Euro> = {
  "member-check": ShieldCheck,
  "payouts-pending": Euro,
  overdue: Euro,
  offers: Hourglass,
  "waitlist-review": Hourglass,
  "wl-fit": Hourglass,
  "wl-free": Hourglass,
  "wl-unmet": Hourglass,
  "wl-noprogram": Hourglass,
  "wl-new": Hourglass,
  "wl-followup": Hourglass,
  "wl-min": Users,
  memberships: Users,
  requests: ListChecks,
  "adult-interest": UserRound,
  "family-swim": Waves,
  messages: MailOpen,
  unstaffed: CalendarCheck,
};

const TASK_TEXT: Record<string, { todo: string; action: string }> = {
  "member-check": {
    todo: "Diese Familien haben „Mitglied“ angegeben, im System ist aber keine aktive Mitgliedschaft. Entscheide je Buchung: Mitgliedspreis oder Normalpreis. Erst dann geht die Zahlungsmail raus.",
    action: "Zur Zahlungsliste",
  },
  overdue: {
    todo: "Die Zahlungsfrist ist abgelaufen. Als bezahlt markieren, erinnern oder Frist verlängern.",
    action: "Offene Zahlungen öffnen",
  },
  offers: {
    todo: "Platzangebote, deren Frist in den nächsten 48 Stunden endet. Familie erinnern oder Absage erfassen.",
    action: "Angebote ansehen",
  },
  "waitlist-review": {
    todo: "Fällige Wiedervorlagen und Familien mit 3 oder mehr Absagen/Stornos (Sperrliste ja oder nein).",
    action: "Anfrageliste öffnen",
  },
  "wl-fit": {
    todo: "Ein Platz ist frei, aber bei den Wartenden passt nichts automatisch (meist ist das Schwimmniveau unbekannt oder zu niedrig). Bitte von Hand entscheiden.",
    action: "Anfrageliste öffnen",
  },
  "wl-free": {
    todo: "Kurse mit freien Plätzen, für die Familien passend warten. Plätze anbieten.",
    action: "Anfrageliste öffnen",
  },
  "wl-unmet": {
    todo: "Wartende, deren Schwimmniveau nicht zum gewünschten Angebot passt. Prüfen, ob ein anderes Angebot passt.",
    action: "Wartende ansehen",
  },
  "wl-noprogram": {
    todo: "Diese Einträge sind keinem Kursangebot zugeordnet (z. B. alte Anfragen). Sie bekommen nie automatisch ein Angebot. In der Liste direkt am Eintrag unter „Kurswunsch fehlt“ das passende Kursangebot wählen – danach läuft die Vergabe wie gewohnt.",
    action: "Einträge ohne Zuordnung öffnen",
  },
  "wl-new": {
    todo: "Was Eltern in den letzten 7 Tagen getan haben: Anmeldungen, Buchungen, Nachrichten, Anträge. Zum Überblick; Einträge ohne Zuständigkeit hier zuweisen.",
    action: "Anfrageliste öffnen",
  },
  "wl-followup": {
    todo: "Die Familien haben „Warteliste behalten?“ erhalten. Ohne Antwort wird der Eintrag nach Fristende automatisch gestrichen. Nur zur Info.",
    action: "Rückfragen ansehen",
  },
  "wl-min": {
    todo: "Kurse, die noch starten und die Mindestteilnehmerzahl noch nicht erreicht haben.",
    action: "Anfrageliste öffnen",
  },
  "payouts-pending": {
    todo: "Abrechnungen für Übungsleiter:innen, die auf deine Kontrolle warten. Freigeben kann nur, wer sie nicht angelegt hat und sie nicht selbst bekommt. Danach in MeinVerein buchen.",
    action: "Zu den Auszahlungen",
  },
  memberships: {
    todo: "Neue Mitgliedsanträge prüfen: genehmigen, Rückfrage stellen oder ablehnen.",
    action: "Mitgliedschaften öffnen",
  },
  requests: {
    todo: "Neue Kursanfragen aus dem alten Anfrageformular.",
    action: "Kursanfragen öffnen",
  },
  "adult-interest": {
    todo: "Neue unverbindliche Interessenten für das Erwachsenenschwimmen.",
    action: "Interessenten öffnen",
  },
  "family-swim": {
    todo: "Neue Vormerkungen fürs Mitgliederschwimmen, die noch nicht verteilt sind. Vorschlag berechnen und übernehmen.",
    action: "Mitgliederschwimmen öffnen",
  },
  messages: {
    todo: "Nachrichten aus dem Kontaktformular, die noch eine Antwort brauchen. Beschwerden stehen oben.",
    action: "Nachrichten öffnen",
  },
  unstaffed: {
    todo: "Kurstermine in den nächsten 14 Tagen, bei denen noch Trainer:innen fehlen. Einteilen oder Ersatz anfragen.",
    action: "Lücken im Dienstplan",
  },
};

const TONE_DOT: Record<InboxEntry["tone"], string> = {
  urgent: "bg-destructive",
  attention: "bg-warning",
  info: "bg-primary",
  mine: "bg-accent",
};

const TONE_LABEL: Record<InboxEntry["tone"], string> = {
  urgent: "Dringend",
  attention: "Bald erledigen",
  info: "Zur Info",
  mine: "Mir zugewiesen",
};

const shortName = (name: string) => name.replace(/^Schwimmabzeichen /, "");

/** Aufgaben aus der Anfrageliste – dieselben Regeln wie dort (buildTodo). */
function waitlistTasks(
  data: Parameters<typeof buildTodo>[0],
  error: unknown,
  rules: Parameters<typeof buildTodo>[2],
): AdminTask[] {
  const to = "/admin/warteliste";
  if (error)
    return [
      {
        key: "wl-error",
        label: "Anfrageliste konnte nicht geladen werden",
        count: 1,
        to,
        tone: "urgent",
        hint: error instanceof Error ? error.message : undefined,
      },
    ];
  if (!data) return [];
  const t = buildTodo(data, "", rules);
  const due = t.dueFollowUps.length;
  const sug = t.suggestions.length;
  return [
    {
      key: "offers",
      label: "Wartelisten-Angebote laufen bald ab",
      count: t.expiringOffers.length,
      to,
      search: { ansicht: "offered" },
      tone: "urgent",
      hint: "in den nächsten 48 Stunden",
    },
    {
      key: "wl-fit",
      label: "Freier Platz: Passt das? Von Hand prüfen",
      count: t.fitChecks.length,
      to,
      tone: "urgent",
      hint: "nichts passt automatisch",
    },
    {
      key: "wl-free",
      label: "Freie Plätze mit wartenden Familien",
      count: t.freeCourses.length,
      to,
      tone: "attention",
      hint: t.freeCourses
        .slice(0, 3)
        .map((x) => `${shortName(x.course.name)}: ${x.course.free} frei`)
        .join(" · "),
    },
    {
      key: "waitlist-review",
      label: "Anfrageliste: Wiedervorlagen und Sperrvorschläge",
      count: due + sug,
      to,
      tone: "attention",
      hint: `${due} Wiedervorlage(n), ${sug} Sperrvorschlag/-vorschläge`,
    },
    {
      key: "wl-unmet",
      label: "Wartende: Voraussetzung nicht erfüllt",
      count: t.waitUnmet.length,
      to,
      search: { ansicht: "waiting", grund: "unmet" },
      tone: "attention",
      hint: "Schwimmniveau passt nicht",
    },
    {
      key: "wl-noprogram",
      label: "Wartende ohne Kursangebot",
      count: t.waitNoProgram.length,
      to,
      search: { ansicht: "waiting", programm: "none" },
      tone: "attention",
      hint: "bitte von Hand einem Kurs zuordnen",
    },
    {
      key: "wl-new",
      label: "Neu: Aktionen der Eltern",
      count: t.newEntries.length + t.newDirect.length + t.newOther.length,
      to,
      tone: "info",
      hint: `letzte 7 Tage · ${t.newUnassigned.length} ohne Zuständigkeit`,
    },
    {
      key: "wl-min",
      label: "Kurse unter der Mindestzahl",
      count: t.minCourses.length,
      to,
      tone: "info",
      hint: t.minCourses
        .slice(0, 2)
        .map((c) => `${shortName(c.name)} ${c.confirmed}/${c.min_participants}`)
        .join(" · "),
    },
    {
      key: "wl-followup",
      label: "Rückfrage „Warteliste behalten?“ läuft",
      count: t.followups.length,
      to,
      search: { ansicht: "followup" },
      tone: "info",
      hint: "Antwort der Familien steht aus",
    },
  ];
}

function useInbox() {
  const [tasks, setTasks] = useState<AdminTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<MyAssignments | null>(null);
  const load = useCallback(() => {
    getAdminTasks()
      .then((r) => {
        setTasks(r.tasks);
        setError(null);
      })
      // Nicht als „alles erledigt“ tarnen: Ladefehler deutlich zeigen.
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Aufgaben konnten nicht geladen werden"),
      );
    getMyAssignments()
      .then(setMine)
      .catch(() => setMine(null));
  }, []);
  useEffect(load, [load]);
  // Anfrageliste: gleiche Abfrage wie dort, damit Zahlen und Listen übereinstimmen
  const wl = useQuery({ queryKey: WAITLIST_QUERY_KEY, queryFn: () => listWaitlist() });
  const ctx = useAssignmentContext();
  const bdays = useBirthdays();

  const entries = useMemo<InboxEntry[] | null>(() => {
    if (tasks === null || wl.isLoading) return null;
    const own: InboxEntry[] = mine?.me
      ? [
          {
            id: "mine-payments",
            label: "Zahlungen",
            count: mine.payments,
            to: "/admin/zahlungen",
            icon: Euro,
            todo: "Offene Zahlungen, für die du zuständig bist.",
            action: "Meine Zahlungen öffnen",
          },
          {
            id: "mine-messages",
            label: "Nachrichten",
            count: mine.messages,
            to: "/admin/nachrichten",
            icon: MailOpen,
            todo: "Nachrichten, die dir zugewiesen sind.",
            action: "Meine Nachrichten öffnen",
          },
          {
            id: "mine-waitlist",
            label: "Anfrageliste",
            count: mine.waitlist,
            to: "/admin/warteliste",
            icon: Hourglass,
            todo: "Einträge in der Anfrageliste, für die du zuständig bist.",
            action: "Meine Anfragen öffnen",
          },
        ]
          .filter((e) => e.count > 0)
          .map((e) => ({
            ...e,
            group: "mine" as const,
            tone: "mine" as const,
            hint: mine.me ?? undefined,
            search: { zustaendig: "ich" },
          }))
      : [];
    const order: AdminTask["tone"][] = ["urgent", "attention", "info"];
    const open: InboxEntry[] = [...tasks, ...waitlistTasks(wl.data, wl.error, ctx.data?.rules)]
      .filter((t) => t.count > 0)
      .sort((a, b) => order.indexOf(a.tone) - order.indexOf(b.tone))
      .map((t) => ({
        id: t.key,
        group: "task" as const,
        label: t.label,
        count: t.count,
        hint: t.hint,
        to: t.to,
        search: t.search as Record<string, string> | undefined,
        tone: t.tone,
        icon: TASK_ICON[t.key] ?? ListChecks,
        todo: TASK_TEXT[t.key]?.todo ?? "",
        action: TASK_TEXT[t.key]?.action ?? "Öffnen",
      }));
    // Geburtstage: Hinweis, kein Pflichtpunkt; dringlicher, sobald heute (oder kürzlich) jemand Geburtstag hat
    const bd = bdays.data ?? [];
    const toGreet = bd.filter((b) => b.inTagen <= 0 && !b.sentAt && b.hasEmail).length;
    const info: InboxEntry[] =
      bd.length > 0
        ? [
            {
              id: "birthdays",
              group: "info",
              label: "Geburtstage",
              count: bd.length,
              hint: toGreet > 0 ? `${toGreet} jetzt gratulieren` : "in den nächsten 30 Tagen",
              to: "",
              tone: toGreet > 0 ? "attention" : "info",
              icon: Cake,
              todo: "Mitglieder einschließlich Partner:in und Kinder mit Geburtstag in den nächsten 30 Tagen. Ab dem Geburtstag (bis 3 Tage danach) kann per Knopf gratuliert werden; bei Kindern geht die Mail an die Eltern. Es wird nichts automatisch versendet.",
              action: "",
            },
          ]
        : [];
    return [...own, ...open, ...info];
  }, [tasks, mine, bdays.data, wl.data, wl.error, wl.isLoading, ctx.data?.rules]);

  return { entries, error, reload: load };
}

function EntryRow({
  entry,
  selected,
  onSelect,
}: {
  entry: InboxEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = entry.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full text-left grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 rounded-xl px-4 py-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selected ? "bg-secondary ring-2 ring-primary" : "bg-card hover:bg-surface shadow-soft"
      }`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary-deep">
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${TONE_DOT[entry.tone]}`} aria-hidden="true" />
          {TONE_LABEL[entry.tone]}
        </span>
        <span className="block font-bold text-foreground">{entry.label}</span>
        {entry.hint && (
          <span className="block truncate text-xs text-muted-foreground">{entry.hint}</span>
        )}
      </span>
      <span className="min-w-8 rounded-full bg-primary-deep px-2.5 py-0.5 text-center text-sm font-bold text-white">
        {entry.count}
      </span>
    </button>
  );
}

function EntryDetail({ entry, onChanged }: { entry: InboxEntry; onChanged: () => void }) {
  const Icon = entry.icon;
  const panel = panelFor(entry.id, onChanged);
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card text-primary-deep shadow-soft">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {TONE_LABEL[entry.tone]} · {entry.count}
            {entry.group === "info" ? "" : " offen"}
          </div>
          <h2 className="font-display text-2xl font-bold text-primary-deep">{entry.label}</h2>
          {entry.hint && <p className="mt-1 text-sm text-muted-foreground">{entry.hint}</p>}
        </div>
      </div>
      {entry.todo && <p className="text-foreground">{entry.todo}</p>}

      {/* Die Vorgänge selbst, mit denselben Knöpfen wie auf ihrer eigenen Seite. */}
      {panel}

      {entry.to && (
        <Button asChild size={panel ? "default" : "lg"} variant={panel ? "outline" : "default"}>
          <Link to={entry.to as never} search={entry.search as never}>
            {panel ? "Ganze Liste öffnen" : entry.action}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      )}
    </div>
  );
}

/** Bearbeitung direkt im Eingang, wo es dafür schon einen Baustein gibt; sonst null (dann nur Sprung). */
function panelFor(id: string, onChanged: () => void) {
  switch (id) {
    case "member-check":
      return <MemberCheckPanel onChanged={onChanged} />;
    case "overdue":
      return <PaymentsPanel only="overdue" onChanged={onChanged} />;
    case "mine-payments":
      return <PaymentsPanel only="mine" onChanged={onChanged} />;
    case "messages":
      return <MessagesPanel only="open" onChanged={onChanged} />;
    case "mine-messages":
      return <MessagesPanel only="mine" onChanged={onChanged} />;
    case "unstaffed":
      return <GapsPanel onChanged={onChanged} />;
    case "offers":
      return (
        <WaitlistPanel
          sections={[{ only: "expiring", label: "Angebote laufen ab" }]}
          onChanged={onChanged}
        />
      );
    case "waitlist-review":
      return (
        <WaitlistPanel
          sections={[
            { only: "due", label: "Wiedervorlagen" },
            { only: "suggestions", label: "Sperrvorschläge" },
          ]}
          onChanged={onChanged}
        />
      );
    case "wl-fit":
      return (
        <WaitlistPanel
          sections={[{ only: "fit", label: "Von Hand prüfen" }]}
          onChanged={onChanged}
        />
      );
    case "wl-free":
      return (
        <WaitlistPanel sections={[{ only: "free", label: "Freie Plätze" }]} onChanged={onChanged} />
      );
    case "wl-new":
      return (
        <WaitlistPanel
          sections={[{ only: "new", label: "Neue Anmeldungen" }]}
          onChanged={onChanged}
        />
      );
    case "wl-min":
      return (
        <WaitlistPanel sections={[{ only: "min", label: "Mindestzahl" }]} onChanged={onChanged} />
      );
    case "birthdays":
      return <BirthdaysPanel onChanged={onChanged} />;
    case "family-swim":
      return <FamilySwimPanel onChanged={onChanged} />;
    case "memberships":
      return <MembershipsPanel onChanged={onChanged} />;
    case "requests":
      return <CourseRequestsPanel onChanged={onChanged} />;
    default:
      return null;
  }
}

function Eingang() {
  const { entries, error, reload } = useInbox();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    entries?.find((e) => e.id === selectedId) ??
    entries?.find((e) => e.group === "task") ??
    entries?.[0] ??
    null;
  const total = entries?.filter((e) => e.group === "task").reduce((n, e) => n + e.count, 0) ?? 0;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-bold text-primary-deep">Eingang</h1>
          <p className="text-muted-foreground mt-1">
            Alles, was zu tun ist. Links auswählen, rechts bearbeiten.
          </p>
        </div>
        {entries && (
          <span className="text-sm font-semibold text-muted-foreground">{total} offen</span>
        )}
      </div>

      <OpenAvailabilityNotice />

      {error && entries === null ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm"
        >
          Aufgaben konnten nicht geladen werden: {error}
        </p>
      ) : entries === null ? (
        <p className="text-sm text-muted-foreground">Aufgaben werden geladen …</p>
      ) : entries.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/10 p-4 text-foreground">
          <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
          <span className="text-sm font-medium">Alles erledigt – aktuell liegt nichts an.</span>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <nav aria-label="Offene Aufgaben" className="space-y-2 lg:sticky lg:top-6 lg:self-start">
            {entries.map((e) => (
              <EntryRow
                key={e.id}
                entry={e}
                selected={selected?.id === e.id}
                onSelect={() => setSelectedId(e.id)}
              />
            ))}
          </nav>
          <section aria-label="Bearbeitung" className="min-w-0 rounded-2xl bg-secondary/60 p-6">
            {selected && <EntryDetail key={selected.id} entry={selected} onChanged={reload} />}
          </section>
        </div>
      )}
    </div>
  );
}
