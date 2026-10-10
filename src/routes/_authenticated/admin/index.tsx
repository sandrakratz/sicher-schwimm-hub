import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { OpenAvailabilityNotice } from "@/components/OpenAvailabilityNotice";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarCheck,
  CheckCircle2,
  Euro,
  Hourglass,
  ListChecks,
  MailOpen,
  Users,
} from "lucide-react";
import { assertHasAnyRole } from "@/lib/role-guard";
import { getAdminTasks, type AdminTask } from "@/lib/admin-dashboard.functions";
import { getMyAssignments, type MyAssignments } from "@/lib/my-assignments.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  beforeLoad: async () => {
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board"] } });
    } catch {
      throw redirect({ to: "/admin/benutzer" });
    }
  },
  component: AdminDashboard,
});

const TONE: Record<AdminTask["tone"], string> = {
  urgent: "border-l-4 border-l-red-500",
  attention: "border-l-4 border-l-amber-400",
  info: "border-l-4 border-l-sky-400",
};

const TASK_ICON: Record<string, typeof Euro> = {
  overdue: Euro,
  offers: Hourglass,
  "waitlist-review": Hourglass,
  memberships: Users,
  requests: ListChecks,
  messages: MailOpen,
  unstaffed: CalendarCheck,
};

/** Eine Kachel im Stil der Kennzahlen: Symbol, Bezeichnung, große Zahl, Hinweis. */
function TaskCard({
  icon: Icon,
  label,
  value,
  hint,
  to,
  search,
  className = "",
}: {
  icon: typeof Euro;
  label: string;
  value: number;
  hint?: string;
  to: string;
  search?: Record<string, string>;
  className?: string;
}) {
  return (
    <Link
      to={to as never}
      search={search as never}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl"
    >
      <Card
        className={`border-0 shadow-soft hover:shadow-lg hover:-translate-y-0.5 transition cursor-pointer h-full ${className}`}
      >
        <CardContent className="p-5">
          <Icon className="h-7 w-7 text-accent mb-3" />
          <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            {label}
          </div>
          <div className="text-3xl font-bold text-primary-deep">{value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </CardContent>
      </Card>
    </Link>
  );
}

/** Was ist mir zugewiesen (ausdrücklich oder per Standard-Zuständigkeit)? Mit Sprung in die gefilterte Liste. */
function MyAssignmentsSection() {
  const [mine, setMine] = useState<MyAssignments | null>(null);
  useEffect(() => {
    getMyAssignments()
      .then(setMine)
      .catch(() => setMine(null));
  }, []);
  if (!mine || !mine.me) return null;
  const cards = [
    { icon: Euro, label: "Zahlungen", value: mine.payments, to: "/admin/zahlungen" },
    { icon: MailOpen, label: "Nachrichten", value: mine.messages, to: "/admin/nachrichten" },
    { icon: Hourglass, label: "Anfrageliste", value: mine.waitlist, to: "/admin/warteliste" },
  ].filter((c) => c.value > 0);
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-bold text-primary-deep">Mir zugewiesen</h2>
      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ihnen ist aktuell nichts zugewiesen.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <TaskCard
              key={c.label}
              icon={c.icon}
              label={c.label}
              value={c.value}
              hint={`${mine.me} · Liste öffnen`}
              to={c.to}
              search={{ zustaendig: "ich" }}
              className="border-l-4 border-l-primary"
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TaskList() {
  const [tasks, setTasks] = useState<AdminTask[] | null>(null);
  useEffect(() => {
    getAdminTasks()
      .then((r) => setTasks(r.tasks))
      .catch(() => setTasks([]));
  }, []);

  if (tasks === null) {
    return <p className="text-sm text-muted-foreground">Aufgaben werden geladen …</p>;
  }

  const open = tasks.filter((t) => t.count > 0);
  if (open.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-medium">Alles erledigt – aktuell liegt nichts an.</span>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-bold text-primary-deep">Zu erledigen</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {open.map((t) => (
          <TaskCard
            key={t.key}
            icon={TASK_ICON[t.key] ?? ListChecks}
            label={t.label}
            value={t.count}
            hint={t.hint}
            to={t.to}
            search={t.search as Record<string, string> | undefined}
            className={TONE[t.tone]}
          />
        ))}
      </div>
    </section>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState({ requests: 0, memberships: 0, members: 0, messages: 0 });
  useEffect(() => {
    (async () => {
      const [r, m, p, msg] = await Promise.all([
        supabase
          .from("course_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "new"),
        supabase
          .from("memberships")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .in("status", ["new", "read"]),
      ]);
      setStats({
        requests: r.count || 0,
        memberships: m.count || 0,
        members: p.count || 0,
        messages: msg.count || 0,
      });
    })();
  }, []);

  const cards = [
    {
      icon: ListChecks,
      label: "Neue Kursanfragen",
      to: "/admin/archiv" as const,
      search: { tab: "archive" as const },
    },
    {
      icon: Users,
      label: "Mitgliedsanträge offen",
      value: stats.memberships,
      to: "/admin/mitgliedschaften" as const,
    },
    { icon: Users, label: "Aktive Benutzer", value: stats.members, to: "/admin/benutzer" as const },
    {
      icon: MailOpen,
      label: "Unbeantwortete Nachrichten",
      value: stats.messages,
      to: "/admin/nachrichten" as const,
    },
  ];
  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <div className="text-accent font-semibold text-sm uppercase tracking-wider">Admin</div>
        <h1 className="font-display text-4xl font-bold text-primary-deep">Heute</h1>
        <p className="text-muted-foreground mt-2">Was heute zu tun ist, auf einen Blick.</p>
      </div>

      <OpenAvailabilityNotice />
      <MyAssignmentsSection />
      <TaskList />
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-primary-deep">Auf einen Blick</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((s) => (
            <Link
              key={s.label}
              to={s.to}
              search={(s as { search?: { tab: "archive" } }).search as never}
              className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl"
            >
              <Card className="border-0 shadow-soft hover:shadow-lg hover:-translate-y-0.5 transition cursor-pointer h-full">
                <CardContent className="p-5">
                  <s.icon className="h-7 w-7 text-accent mb-3" />
                  <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    {s.label}
                  </div>
                  <div className="text-3xl font-bold text-primary-deep">{s.value}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
      <Card className="border-0 shadow-soft">
        <CardContent className="p-6">
          <h2 className="font-display text-xl font-bold text-primary-deep">Schnellstart</h2>
          <p className="text-muted-foreground text-sm mt-2">
            Wählen Sie links einen Bereich zur Verwaltung oder klicken Sie eine Kachel oben an.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
