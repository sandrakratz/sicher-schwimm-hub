import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, CalendarDays, MapPin } from "lucide-react";
import { formatDateBerlin } from "@/lib/format";
import { OpenAvailabilityNotice } from "@/components/OpenAvailabilityNotice";

export const Route = createFileRoute("/_authenticated/trainer/")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/admin-guard.functions");
    const { redirect } = await import("@tanstack/react-router");
    try { await assertHasAnyRole({ data: { roles: ["admin", "board", "trainer"] } }); }
    catch { throw redirect({ to: "/portal" }); }
  },
  head: () => ({
    meta: [
      { title: "Trainerbereich | Sicher Schwimmen e.V." },
      { name: "description", content: "Eigene Kurstermine, Einteilungen und Helfer-Einsätze auf einen Blick." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TrainerHome,
});

type Row = {
  id: string;
  session_date: string;
  session_index: number;
  course: { name: string; location: string | null; schedule: string | null } | null;
};

function TrainerHome() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user?.id;
      if (!me) { setLoading(false); return; }
      const today = new Date().toISOString().slice(0, 10);

      const { data: assignments } = await supabase
        .from("course_session_assignments")
        .select("session_id")
        .eq("trainer_id", me);
      const ids = (assignments ?? []).map((a) => a.session_id);

      const { data: sessions } = await supabase
        .from("course_sessions")
        .select("id,session_date,session_index,assigned_trainer_id,courses(name,location,schedule)")
        .gte("session_date", today)
        .order("session_date", { ascending: true });

      const mine = ((sessions as any[]) ?? []).filter(
        (s) => ids.includes(s.id) || s.assigned_trainer_id === me,
      );
      setRows(
        mine.map((s) => ({
          id: s.id,
          session_date: s.session_date,
          session_index: s.session_index,
          course: s.courses ?? null,
        })),
      );
      setLoading(false);
    })();
  }, []);

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl font-bold text-primary-deep mb-2">Trainerbereich</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Hier siehst du nur deine eigenen Termine und kannst deine Verfügbarkeit pflegen.
      </p>

      <OpenAvailabilityNotice />

      <div className="mb-6">
        <Link
          to="/trainer/verfuegbarkeit"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <CalendarCheck className="h-4 w-4" /> Verfügbarkeit eintragen
        </Link>
      </div>

      <h2 className="font-display text-2xl font-bold text-primary-deep mb-3">Meine nächsten Einsätze</h2>
      {loading ? (
        <Card className="border-0 shadow-soft"><CardContent className="py-10 text-center text-muted-foreground">Wird geladen …</CardContent></Card>
      ) : rows.length === 0 ? (
        <Card className="border-0 shadow-soft"><CardContent className="py-10 text-center text-muted-foreground">Aktuell bist du für keine kommenden Termine eingeteilt.</CardContent></Card>
      ) : (
        <div className="divide-y rounded-md border bg-card">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <div className="text-sm font-medium">
                  {r.course?.name ?? "Kurs"} · {r.session_index}. Termin
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{formatDateBerlin(r.session_date)}</span>
                  {r.course?.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{r.course.location}</span>}
                  {r.course?.schedule && <span>{r.course.schedule}</span>}
                </div>
              </div>
              <Badge className="border-transparent bg-primary text-primary-foreground">Eingeteilt</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
