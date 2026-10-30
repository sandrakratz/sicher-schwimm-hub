import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, HandHelping } from "lucide-react";
import { fetchAll, fetchIn } from "@/lib/fetch-all";
import { useReplacementCount } from "@/lib/use-replacement-count";

/**
 * Hinweise für Trainer:innen auf der Startseite: Termine, die Ersatz suchen, und offene
 * Helfer-Umfragen zu Veranstaltungen. (Die Abfrage je Kurstermin ist durch die Bereitschaft je
 * Kursart ersetzt und daher keine Pflicht mehr.)
 */
export function OpenAvailabilityNotice() {
  const [isTeam, setIsTeam] = useState(false);
  const [openEvents, setOpenEvents] = useState(0);
  const replacements = useReplacementCount(isTeam);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const me = u.user?.id;
      if (!me) return;

      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", me);
      if (!(roles || []).some((r) => ["trainer", "admin", "board"].includes(r.role as string)))
        return;
      setIsTeam(true);

      const evRows = await fetchAll<{ id: string }>((f, t) =>
        supabase
          .from("events")
          .select("id")
          .eq("signup_enabled", true)
          .gte("starts_at", new Date().toISOString())
          .order("id")
          .range(f, t),
      );
      const eventIds = evRows.map((e) => e.id);
      if (eventIds.length > 0) {
        const su = await fetchIn<{ event_id: string }>(eventIds, (chunk, f, t) =>
          supabase
            .from("event_shift_signups")
            .select("event_id")
            .eq("trainer_id", me)
            .in("event_id", chunk)
            .order("id")
            .range(f, t),
        );
        const answered = new Set(su.map((s) => s.event_id));
        setOpenEvents(eventIds.filter((id) => !answered.has(id)).length);
      }
    })();
  }, []);

  if (replacements === 0 && openEvents === 0) return null;

  return (
    <div className="space-y-3">
      {replacements > 0 && (
        <Card className="border-2 border-amber-400/60 bg-amber-50/50 shadow-soft dark:bg-amber-950/10">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex items-start gap-3">
              <HandHelping className="mt-0.5 h-6 w-6 shrink-0" />
              <div>
                <div className="font-semibold text-primary-deep">
                  {replacements === 1 ? "Ein Termin sucht" : `${replacements} Termine suchen`}{" "}
                  Ersatz
                </div>
                <p className="text-sm text-muted-foreground">
                  Kannst du einspringen? Wer zuerst klickt, ist eingeteilt.
                </p>
              </div>
            </div>
            <Button asChild size="sm" className="min-h-11">
              <Link to="/trainer/verfuegbarkeit">Termine ansehen</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      {openEvents > 0 && (
        <Card className="border-0 shadow-soft bg-accent/10">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
              <div>
                <div className="font-semibold text-primary-deep">Offene Helfer-Umfragen</div>
                <p className="text-sm text-muted-foreground">
                  Zu {openEvents} Veranstaltung{openEvents === 1 ? "" : "en"} fehlt deine
                  Rückmeldung.
                </p>
              </div>
            </div>
            <Button asChild size="sm" className="min-h-11">
              <Link to="/trainer/verfuegbarkeit">Jetzt beantworten</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
