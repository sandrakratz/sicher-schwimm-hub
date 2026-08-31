import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock } from "lucide-react";

/**
 * Hinweis für Trainer:innen: offene (noch nicht beantwortete) Kurstermine
 * und Helfer-Umfragen zu Terminen.
 */
export function OpenAvailabilityNotice() {
  const [openSessions, setOpenSessions] = useState(0);
  const [openEvents, setOpenEvents] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const me = u.user?.id;
      if (!me) return;

      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", me);
      const isTeam = (roles || []).some(r => ["trainer", "admin", "board"].includes(r.role as string));
      if (!isTeam) return;

      const today = new Date().toISOString().slice(0, 10);
      const nowIso = new Date().toISOString();

      const [sessRes, evRes] = await Promise.all([
        supabase.from("course_sessions").select("id").gte("session_date", today),
        supabase.from("events").select("id").eq("signup_enabled", true).gte("starts_at", nowIso),
      ]);
      const sessionIds = (sessRes.data || []).map(s => s.id);
      const eventIds = (evRes.data || []).map(e => e.id);

      if (sessionIds.length > 0) {
        const { data: av } = await supabase
          .from("course_session_availability")
          .select("session_id")
          .eq("trainer_id", me)
          .in("session_id", sessionIds);
        const answered = new Set((av || []).map(a => a.session_id));
        setOpenSessions(sessionIds.filter(id => !answered.has(id)).length);
      }

      if (eventIds.length > 0) {
        const { data: su } = await supabase
          .from("event_shift_signups")
          .select("event_id")
          .eq("trainer_id", me)
          .in("event_id", eventIds);
        const answered = new Set((su || []).map(s => s.event_id));
        setOpenEvents(eventIds.filter(id => !answered.has(id)).length);
      }
    })();
  }, []);

  if (openSessions === 0 && openEvents === 0) return null;

  const parts = [
    openSessions > 0 ? `${openSessions} Kurstermin${openSessions === 1 ? "" : "e"}` : null,
    openEvents > 0 ? `${openEvents} Helfer-Umfrage${openEvents === 1 ? "" : "n"}` : null,
  ].filter(Boolean);

  return (
    <Card className="border-0 shadow-soft bg-accent/10">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <CalendarClock className="mt-0.5 h-6 w-6 text-accent shrink-0" />
          <div>
            <div className="font-semibold text-primary-deep">Offene Rückmeldungen zur Verfügbarkeit</div>
            <p className="text-sm text-muted-foreground">
              Du hast {parts.join(" und ")} noch nicht beantwortet. Bitte gib an, wann du kannst.
            </p>
          </div>
        </div>
        <Button asChild size="sm">
          <Link to="/admin/verfuegbarkeit">Jetzt beantworten</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
