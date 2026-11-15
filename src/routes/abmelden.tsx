import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAbsenceInfo, setAbsence } from "@/lib/absence.functions";

export const Route = createFileRoute("/abmelden")({
  validateSearch: (s) => z.object({ token: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Kind abmelden – Sicher Schwimmen e.V." },
      {
        name: "description",
        content: "Melden Sie Ihr Kind für einzelne Kurstermine ab, zum Beispiel bei Krankheit.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

type Info = Awaited<ReturnType<typeof getAbsenceInfo>>;

function dateLabel(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Berlin",
  });
}

function Page() {
  const { token } = Route.useSearch();
  const load = useServerFn(getAbsenceInfo);
  const save = useServerFn(setAbsence);
  const [info, setInfo] = useState<Info | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !/^[a-f0-9]{20,80}$/.test(token)) {
      setInfo({ found: false });
      return;
    }
    load({ data: { token } })
      .then(setInfo)
      .catch(() => setInfo({ found: false }));
  }, [token]);

  async function toggle(sessionId: string, absent: boolean) {
    if (!token) return;
    setBusyId(sessionId);
    try {
      await save({ data: { token, sessionIds: [sessionId], absent } });
      setInfo((cur) =>
        cur && cur.found
          ? {
              ...cur,
              sessions: cur.sessions.map((s) => (s.id === sessionId ? { ...s, absent } : s)),
            }
          : cur,
      );
    } catch (err: any) {
      toast.error(err?.message || "Speichern fehlgeschlagen. Bitte versuchen Sie es erneut.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PublicLayout>
      <div className="container mx-auto max-w-xl px-4 py-10">
        <h1 className="text-3xl font-bold text-primary-deep mb-2">Kind abmelden</h1>
        {!info && <p className="text-muted-foreground">Wird geladen …</p>}
        {info && !info.found && (
          <Card>
            <CardContent className="p-6">
              Dieser Link ist ungültig oder die Buchung wurde storniert. Bitte schreiben Sie uns an
              kurse@sicher-schwimmen.com.
            </CardContent>
          </Card>
        )}
        {info?.found && (
          <>
            <p className="text-muted-foreground mb-6">
              {info.childName ? <strong>{info.childName}</strong> : "Ihr Kind"}
              {info.courseName ? ` · ${info.courseName}` : ""}
              <br />
              Tippen Sie bei dem Termin auf „Abmelden“, an dem Ihr Kind nicht teilnehmen kann. Die
              Trainer sehen die Abmeldung sofort. Ein Grund ist nicht nötig.
            </p>
            {info.sessions.length === 0 ? (
              <Card>
                <CardContent className="p-6">Es stehen keine weiteren Termine an.</CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {info.sessions.map((s) => (
                  <Card key={s.id}>
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{dateLabel(s.date)}</div>
                        {s.absent && (
                          <div className="flex items-center gap-1 text-sm text-green-700">
                            <CheckCircle2 className="h-4 w-4" /> Abgemeldet
                          </div>
                        )}
                      </div>
                      <Button
                        variant={s.absent ? "outline" : "default"}
                        disabled={busyId === s.id}
                        onClick={() => toggle(s.id, !s.absent)}
                      >
                        {s.absent ? "Zurücknehmen" : "Abmelden"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PublicLayout>
  );
}
