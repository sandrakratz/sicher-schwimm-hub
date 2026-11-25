import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateBerlin, fullName } from "@/lib/format";
import { PayoutIbanCard } from "@/components/trainer/PayoutIbanCard";
import { Qualifications } from "@/components/trainer/Qualifications";
import { MyPayouts } from "@/components/trainer/MyPayouts";
import { DeclarationCard } from "@/components/trainer/DeclarationCard";
import { DeviceCard } from "@/components/trainer/DeviceCard";
import { InstallHint } from "@/components/trainer/InstallHint";
import { timeLabel, useMySessions, weekdayLabel } from "@/components/trainer/useMySessions";

export const Route = createFileRoute("/_authenticated/trainer/ich")({
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
      { title: "Ich – Trainerbereich | Sicher Schwimmen e.V." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Ich,
});

/**
 * „Ich“: alles Persönliche an einem Ort – Zahlen für die Abrechnung, Bankverbindung, Auszahlungen,
 * Nachweise und Einstellungen fürs Handy (Mitteilungen, Offline).
 */
function Ich() {
  const { rows, upcoming, confirmed, me, loading, today } = useMySessions();
  const [holder, setHolder] = useState<string | undefined>(undefined);
  const [showDone, setShowDone] = useState(false);

  // Bankverbindung nur für Trainer:innen (Übungsleiterpauschale); Name als Vorschlag für Kontoinhaber:in
  const [isTrainer, setIsTrainer] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  useEffect(() => {
    if (!me) return;
    void (async () => {
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", me),
        supabase.from("profiles").select("first_name,last_name").eq("id", me).maybeSingle(),
      ]);
      setIsTrainer((roles ?? []).some((r) => r.role === "trainer"));
      setHolder(fullName(profile?.first_name, profile?.last_name) || undefined);
      setProfileLoaded(true);
    })();
  }, [me]);

  const currentYear = String(new Date().getFullYear());
  const thisYear = useMemo(
    () => rows.filter((r) => r.session_date.startsWith(currentYear)).length,
    [rows, currentYear],
  );
  const done = useMemo(
    () =>
      confirmed
        .filter((c) => c.date <= today)
        .sort((a, b) => b.date.localeCompare(a.date) || b.sessionIndex - a.sessionIndex),
    [confirmed, today],
  );

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="font-display text-2xl font-bold text-primary-deep sm:text-3xl">Ich</h1>

      <section aria-labelledby="ich-zahlen" className="space-y-3">
        <h2 id="ich-zahlen" className="font-display text-xl font-bold text-primary-deep">
          Meine Einsätze in Zahlen
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Einsätze gesamt" value={rows.length} />
          <StatCard label="Noch anstehend" value={upcoming.length} />
          <StatCard label={`Einsätze ${currentYear}`} value={thisYear} />
          <StatCard
            label="Bereits geleistet (Liste)"
            value={done.length}
            onClick={() => setShowDone(true)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          „Einsätze“ sind alle Kurstermine, für die du eingeteilt bist. „Bereits geleistet“ zählt
          nur Termine, bei denen der Vorstand deine Anwesenheit bestätigt hat.
        </p>
      </section>

      <Dialog open={showDone} onOpenChange={setShowDone}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bereits geleistete Einsätze ({done.length})</DialogTitle>
            <DialogDescription>
              Termine, bei denen der Vorstand deine Anwesenheit bestätigt hat. Zum Nachprüfen bei
              der Abrechnung.
            </DialogDescription>
          </DialogHeader>
          {done.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Noch keine bestätigten Einsätze.
            </p>
          ) : (
            <div className="divide-y rounded-md border bg-card">
              {done.map((d) => {
                const time = timeLabel({ start_time: d.startTime, end_time: d.endTime });
                return (
                  <div key={d.sessionId} className="p-3">
                    <div className="text-sm font-medium">
                      {d.courseName} <span className="font-normal">({d.sessionIndex}. Termin)</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {weekdayLabel(d.date)}, {formatDateBerlin(d.date)}
                      {time ? ` · ${time}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {profileLoaded && isTrainer && <PayoutIbanCard defaultHolder={holder} />}
      {profileLoaded && isTrainer && <DeclarationCard />}
      {me && <MyPayouts />}
      {me && <Qualifications me={me} />}

      <section aria-labelledby="ich-geraet" className="space-y-3">
        <h2 id="ich-geraet" className="font-display text-xl font-bold text-primary-deep">
          Handy &amp; Mitteilungen
        </h2>
        <InstallHint />
        {me && <DeviceCard rows={upcoming} me={me} loading={loading} />}
      </section>

      <Link
        to="/trainer/mitglieder"
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-primary px-4 text-sm font-semibold text-primary sm:w-auto"
      >
        <Users className="h-4 w-4" aria-hidden="true" /> Vereinsmitglieder nachschlagen
      </Link>
    </div>
  );
}

function StatCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) {
  const body = (
    <CardContent className="p-4">
      <div className="text-2xl font-bold text-primary-deep">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </CardContent>
  );
  if (!onClick) return <Card className="border-0 shadow-soft">{body}</Card>;
  return (
    <Card className="border-0 shadow-soft transition-shadow hover:shadow-md">
      <button type="button" onClick={onClick} className="w-full text-left">
        {body}
      </button>
    </Card>
  );
}
