import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, CalendarCheck } from "lucide-react";
import { OpenAvailabilityNotice } from "@/components/OpenAvailabilityNotice";
import { getMyPayoutDetails } from "@/lib/trainer-payout.functions";
import { WeekShifts } from "@/components/trainer/WeekShifts";
import { useMySessions } from "@/components/trainer/useMySessions";
import { useReplacementCount } from "@/lib/use-replacement-count";

export const Route = createFileRoute("/_authenticated/trainer/")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board", "trainer"] } });
    } catch {
      throw redirect({ to: "/portal" });
    }
  },
  head: () => ({
    meta: [
      { title: "Heute – Trainerbereich | Sicher Schwimmen e.V." },
      {
        name: "description",
        content: "Die Einsätze dieser Woche mit Bestätigen und Absagen direkt am Termin.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TrainerHome,
});

/**
 * „Heute“: nur das, was jetzt ansteht – Hinweise, die eine Handlung brauchen, und die Einsätze
 * dieser Woche. Alle Einsätze und Ersatzanfragen stehen unter „Zeiten“, Persönliches unter „Ich“.
 */
function TrainerHome() {
  const { upcoming, me, loading, today } = useMySessions();
  const replacementCount = useReplacementCount(true);

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="font-display text-2xl font-bold text-primary-deep sm:text-3xl">Heute</h1>

      <OpenAvailabilityNotice />
      <PayoutIbanNotice />

      {replacementCount > 0 && (
        <Card className="border-0 bg-warning/15 shadow-soft">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="text-sm">
              <div className="font-semibold text-primary-deep">
                Ersatz gesucht: {replacementCount} Termin{replacementCount === 1 ? "" : "e"}
              </div>
              <div className="text-muted-foreground">Kannst du einspringen?</div>
            </div>
            <Link
              to="/trainer/verfuegbarkeit"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Ansehen <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>
      )}

      <WeekShifts rows={upcoming} me={me} today={today} loading={loading} />

      <Link
        to="/trainer/verfuegbarkeit"
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-primary px-4 text-sm font-semibold text-primary sm:w-auto"
      >
        <CalendarCheck className="h-4 w-4" aria-hidden="true" /> Alle {upcoming.length} kommenden
        Einsätze &amp; Verfügbarkeit
      </Link>
    </div>
  );
}

/** Hinweis, solange für die Auszahlung der Übungsleiterpauschale noch keine IBAN hinterlegt ist. */
function PayoutIbanNotice() {
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      if (!(roles ?? []).some((r) => r.role === "trainer")) return;
      const res = await getMyPayoutDetails();
      setMissing(!res.details);
    })().catch(() => setMissing(false));
  }, []);
  if (!missing) return null;
  return (
    <Card className="border-0 shadow-soft bg-accent/10">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm">
          <div className="font-semibold text-primary-deep">Deine IBAN fehlt noch</div>
          <div className="text-muted-foreground">
            Damit wir die Übungsleiterpauschale überweisen können, trag bitte deine Bankverbindung
            ein.
          </div>
        </div>
        <Link
          to="/trainer/ich"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          IBAN eintragen
        </Link>
      </CardContent>
    </Card>
  );
}
