import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTimeBerlin } from "@/lib/format";
import { Calendar, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/events")({
  component: Page,
});

type Ev = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  visibility: "public" | "members" | "trainers" | "admin";
};

const VISIBILITY_LABEL: Record<string, string> = {
  public: "Öffentlich",
  members: "Mitglieder",
  trainers: "Trainer:innen",
  admin: "Admin",
};

function Page() {
  const [upcoming, setUpcoming] = useState<Ev[]>([]);
  const [past, setPast] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const nowIso = new Date().toISOString();
      const [up, pa] = await Promise.all([
        supabase.from("events").select("*").gte("starts_at", nowIso).order("starts_at", { ascending: true }),
        supabase.from("events").select("*").lt("starts_at", nowIso).order("starts_at", { ascending: false }).limit(10),
      ]);
      setUpcoming((up.data as Ev[]) || []);
      setPast((pa.data as Ev[]) || []);
      setLoading(false);
    })();
  }, []);

  function renderEvent(e: Ev) {
    return (
      <Card key={e.id} className="border-0 shadow-soft">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-lg font-bold text-primary-deep">{e.title}</h3>
              <div className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4" />{formatDateTimeBerlin(e.starts_at)}{e.ends_at ? ` – ${formatDateTimeBerlin(e.ends_at)}` : ""}</span>
                {e.location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{e.location}</span>}
              </div>
            </div>
            <Badge variant="secondary">{VISIBILITY_LABEL[e.visibility] || e.visibility}</Badge>
          </div>
          {e.description && <p className="text-sm text-foreground/90 mt-3 whitespace-pre-line leading-relaxed">{e.description}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary-deep">Termine & Veranstaltungen</h1>
        <p className="text-muted-foreground mt-1 text-sm">Alle Termine, die für dich sichtbar sind.</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-primary-deep">Kommende Termine</h2>
        {loading ? (
          <Card className="border-0 shadow-soft"><CardContent className="p-10 text-center text-muted-foreground">Lade…</CardContent></Card>
        ) : upcoming.length === 0 ? (
          <Card className="border-0 shadow-soft"><CardContent className="p-10 text-center text-muted-foreground">Aktuell keine Termine.</CardContent></Card>
        ) : (
          upcoming.map(renderEvent)
        )}
      </section>

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-primary-deep">Vergangene Termine</h2>
          <div className="opacity-75">{past.map(renderEvent)}</div>
        </section>
      )}
    </div>
  );
}
