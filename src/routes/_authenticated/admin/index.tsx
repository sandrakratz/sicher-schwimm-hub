import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, ListChecks, MailOpen } from "lucide-react";
import { assertHasAnyRole } from "@/lib/admin-guard.functions";

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

function AdminDashboard() {
  const [stats, setStats] = useState({ requests: 0, memberships: 0, members: 0, messages: 0 });
  useEffect(() => {
    (async () => {
      const [r, m, p, msg] = await Promise.all([
        supabase.from("course_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("memberships").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("status", "new"),
      ]);
      setStats({ requests: r.count || 0, memberships: m.count || 0, members: p.count || 0, messages: msg.count || 0 });
    })();
  }, []);

  const cards = [
    { icon: ListChecks, label: "Neue Kursanfragen", value: stats.requests, to: "/admin/anfragen" as const },
    { icon: Users, label: "Mitgliedsanträge offen", value: stats.memberships, to: "/admin/mitgliedschaften" as const },
    { icon: Users, label: "Aktive Benutzer", value: stats.members, to: "/admin/benutzer" as const },
    { icon: MailOpen, label: "Offene Nachrichten", value: stats.messages, to: "/admin/nachrichten" as const },
  ];
  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <div className="text-accent font-semibold text-sm uppercase tracking-wider">Admin</div>
        <h1 className="font-display text-4xl font-bold text-primary-deep">Übersicht</h1>
        <p className="text-muted-foreground mt-2">Verwalten Sie Mitglieder, Kurse, Anfragen und Inhalte.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(s => (
          <Link key={s.label} to={s.to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl">
            <Card className="border-0 shadow-soft hover:shadow-lg hover:-translate-y-0.5 transition cursor-pointer h-full">
              <CardContent className="p-5">
                <s.icon className="h-7 w-7 text-accent mb-3" />
                <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{s.label}</div>
                <div className="text-3xl font-bold text-primary-deep">{s.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="border-0 shadow-soft">
        <CardContent className="p-6">
          <h2 className="font-display text-xl font-bold text-primary-deep">Schnellstart</h2>
          <p className="text-muted-foreground text-sm mt-2">Wählen Sie links einen Bereich zur Verwaltung oder klicken Sie eine Kachel oben an.</p>
        </CardContent>
      </Card>
    </div>
  );
}
