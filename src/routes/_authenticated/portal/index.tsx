import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, FileText, Newspaper, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/")({
  component: Dashboard,
});

type NewsItem = { id: string; title: string; slug: string; published_at: string | null; excerpt: string | null };
type EventItem = { id: string; title: string; starts_at: string; location: string | null };

function Dashboard() {
  const [name, setName] = useState("");
  const [membership, setMembership] = useState<string>("—");
  const [newsCount, setNewsCount] = useState<number | null>(null);
  const [eventsCount, setEventsCount] = useState<number | null>(null);
  const [docsCount, setDocsCount] = useState<number | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase.from("profiles").select("first_name").eq("id", u.user.id).maybeSingle();
      setName(p?.first_name || u.user.email?.split("@")[0] || "");

      const nowIso = new Date().toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [mem, newsRecent, newsList, evCount, evList, docs] = await Promise.all([
        supabase.from("memberships").select("status").eq("user_id", u.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("news").select("id", { count: "exact", head: true }).eq("published", true).gte("published_at", thirtyDaysAgo),
        supabase.from("news").select("id,title,slug,published_at,excerpt").eq("published", true).order("published_at", { ascending: false }).limit(3),
        supabase.from("events").select("id", { count: "exact", head: true }).gte("starts_at", nowIso),
        supabase.from("events").select("id,title,starts_at,location").gte("starts_at", nowIso).order("starts_at", { ascending: true }).limit(3),
        supabase.from("documents").select("id", { count: "exact", head: true }),
      ]);

      setMembership(mem.data?.status === "active" ? "Aktiv" : mem.data?.status ? mem.data.status : "—");
      setNewsCount(newsRecent.count ?? 0);
      setEventsCount(evCount.count ?? 0);
      setDocsCount(docs.count ?? 0);
      setNews((newsList.data as NewsItem[]) ?? []);
      setEvents((evList.data as EventItem[]) ?? []);
    })();
  }, []);

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <div className="text-accent font-semibold text-sm uppercase tracking-wider">Willkommen</div>
        <h1 className="font-display text-4xl font-bold text-primary-deep">Hallo {name}! 👋</h1>
        <p className="text-muted-foreground mt-2">Schön, dass Sie da sind. Hier finden Sie Ihre wichtigsten Vereinsinfos.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { icon: UserIcon, label: "Mitgliedschaft", value: membership, to: "/portal/profil" as const },
          { icon: Newspaper, label: "Neue Beiträge", value: newsCount === null ? "…" : String(newsCount), to: "/portal/news" as const },
          { icon: Calendar, label: "Kommende Termine", value: eventsCount === null ? "…" : String(eventsCount), to: "/portal/events" as const },
          { icon: FileText, label: "Dokumente", value: docsCount === null ? "…" : String(docsCount), to: "/portal/dokumente" as const },
        ]).map(s => (
          <Link key={s.label} to={s.to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl">
            <Card className="border-0 shadow-soft hover:shadow-lg hover:-translate-y-0.5 transition cursor-pointer h-full">
              <CardContent className="p-5">
                <s.icon className="h-7 w-7 text-accent mb-3" />
                <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{s.label}</div>
                <div className="text-2xl font-bold text-primary-deep">{s.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>


      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xl font-bold text-primary-deep">Vereinsnews</h2>
              <Link to="/portal/news" className="text-sm font-semibold text-accent hover:underline">Alle ansehen</Link>
            </div>
            {news.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aktuell liegen keine Beiträge vor.</p>
            ) : (
              <ul className="space-y-3">
                {news.map(n => (
                  <li key={n.id} className="border-b last:border-0 pb-3 last:pb-0">
                    <Link to="/portal/news" className="block group">
                      <div className="font-semibold text-primary-deep group-hover:text-accent">{n.title}</div>
                      {n.published_at && <div className="text-xs text-muted-foreground">{fmtDate(n.published_at)}</div>}
                      {n.excerpt && <div className="text-sm text-muted-foreground line-clamp-2 mt-1">{n.excerpt}</div>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="border-0 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xl font-bold text-primary-deep">Kommende Termine</h2>
              <Link to="/portal/events" className="text-sm font-semibold text-accent hover:underline">Alle ansehen</Link>
            </div>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aktuell sind keine Termine geplant.</p>
            ) : (
              <ul className="space-y-3">
                {events.map(e => (
                  <li key={e.id} className="border-b last:border-0 pb-3 last:pb-0">
                    <div className="font-semibold text-primary-deep">{e.title}</div>
                    <div className="text-xs text-muted-foreground">{fmtDateTime(e.starts_at)}{e.location ? ` · ${e.location}` : ""}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
