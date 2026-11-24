import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { OpenAvailabilityNotice } from "@/components/OpenAvailabilityNotice";
import { MemberCheckPanel } from "@/components/admin/MemberCheckPanel";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
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
  FamilySwimPanel,
  GapsPanel,
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
  group: "mine" | "task";
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
  overdue: Euro,
  offers: Hourglass,
  "waitlist-review": Hourglass,
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
    action: "Angebote in der Anfrageliste",
  },
  "waitlist-review": {
    todo: "Offene Rückfragen, Sperrvorschläge und fällige Wiedervorlagen in der Anfrageliste.",
    action: "Anfrageliste öffnen",
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

  const entries = useMemo<InboxEntry[] | null>(() => {
    if (tasks === null) return null;
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
    const open: InboxEntry[] = tasks
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
    return [...own, ...open];
  }, [tasks, mine]);

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
            {TONE_LABEL[entry.tone]} · {entry.count} offen
          </div>
          <h2 className="font-display text-2xl font-bold text-primary-deep">{entry.label}</h2>
          {entry.hint && <p className="mt-1 text-sm text-muted-foreground">{entry.hint}</p>}
        </div>
      </div>
      {entry.todo && <p className="text-foreground">{entry.todo}</p>}

      {/* Die Vorgänge selbst, mit denselben Knöpfen wie auf ihrer eigenen Seite. */}
      {panel}

      <Button asChild size={panel ? "default" : "lg"} variant={panel ? "outline" : "default"}>
        <Link to={entry.to as never} search={entry.search as never}>
          {panel ? "Ganze Liste öffnen" : entry.action}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
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
    case "family-swim":
      return <FamilySwimPanel onChanged={onChanged} />;
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
