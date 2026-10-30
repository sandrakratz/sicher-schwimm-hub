import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, CloudOff, MapPin, RefreshCw, Users, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateBerlin } from "@/lib/format";
import {
  enqueueMark,
  listQueue,
  loadSnapshot,
  type AttendanceMark,
  type OfflineSnapshot,
} from "@/lib/offline-store";
import { OFFLINE_DAYS, syncQueue } from "@/lib/offline-sync";

// Bewusst ohne Rollenprüfung beim Laden: Die Seite muss auch ohne Netz öffnen. Sie zeigt nur, was zuvor
// auf diesem Gerät gespeichert wurde (nur für eingeteilte Trainer:innen, nach 48 h wieder gelöscht).
export const Route = createFileRoute("/_authenticated/trainer/offline")({
  head: () => ({
    meta: [
      { title: "Offline-Ansicht – Trainerbereich | Sicher Schwimmen e.V." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OfflinePage,
});

const OPTIONS: { value: Exclude<AttendanceMark, null>; label: string }[] = [
  { value: "present", label: "Anwesend" },
  { value: "excused", label: "Entschuldigt" },
  { value: "absent", label: "Fehlt" },
];
const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const plural = (n: number) => `${n} Eintrag${n === 1 ? "" : "träge"}`;

function OfflinePage() {
  const [snap, setSnap] = useState<OfflineSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [marks, setMarks] = useState<Record<string, AttendanceMark>>({});
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const reloadMarks = useCallback(async () => {
    const q = await listQueue();
    setMarks(Object.fromEntries(q.map((m) => [m.key, m.status])));
  }, []);

  async function sync(silent = false) {
    setSyncing(true);
    try {
      const r = await syncQueue();
      await reloadMarks();
      if (r.sent > 0) toast.success(`${plural(r.sent)} übertragen.`);
      else if (!silent && r.left === 0) toast.message("Alles bereits übertragen.");
      else if (!silent) toast.error("Keine Verbindung – es wird später erneut versucht.");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    setOnline(navigator.onLine);
    void loadSnapshot().then((s) => {
      setSnap(s);
      setLoaded(true);
    });
    void reloadMarks();
    const on = () => {
      setOnline(true);
      void sync(true);
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  async function mark(sessionId: string, participantId: string, status: AttendanceMark) {
    const key = `${sessionId}|${participantId}`;
    const next = marks[key] === status ? null : status;
    await enqueueMark({ sessionId, participantId, status: next });
    setMarks((prev) => ({ ...prev, [key]: next }));
    if (navigator.onLine) void sync(true);
  }

  const pending = Object.keys(marks).length;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-primary-deep sm:text-3xl">
          Offline-Ansicht
        </h1>
        {!online ? (
          <Badge variant="outline" className="border-amber-500 text-amber-700">
            <WifiOff className="mr-1 h-3 w-3" /> kein Netz
          </Badge>
        ) : (
          <Badge variant="outline" className="text-success">
            online
          </Badge>
        )}
      </div>

      {pending > 0 && (
        <Card className="border-0 bg-amber-50/60 shadow-soft dark:bg-amber-950/10">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <CloudOff className="h-5 w-5 shrink-0" />
            <span className="flex-1">
              {plural(pending)} noch nicht übertragen. Das geschieht automatisch, sobald du wieder
              Netz hast.
            </span>
            <Button
              size="sm"
              className="min-h-11"
              disabled={syncing || !online}
              onClick={() => void sync()}
            >
              <RefreshCw className="h-4 w-4" /> Jetzt übertragen
            </Button>
          </CardContent>
        </Card>
      )}

      {!loaded ? null : !snap || snap.sessions.length === 0 ? (
        <Card className="border-0 shadow-soft">
          <CardContent className="space-y-3 p-5 text-sm">
            <p className="font-semibold text-primary-deep">Keine Offline-Daten auf diesem Gerät</p>
            <p className="text-muted-foreground">
              Aktiviere auf der Startseite des Trainerbereichs den Offline-Modus, solange du Netz
              hast. Danach stehen die Einsätze der nächsten {OFFLINE_DAYS} Tage auch im Schwimmbad
              bereit.
            </p>
            <Button asChild size="sm" className="min-h-11">
              <Link to="/trainer">Zum Trainerbereich</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Stand: {new Date(snap.generatedAt).toLocaleString("de-DE")} · Die Daten werden nach 48
            Stunden und beim Abmelden von diesem Gerät gelöscht.
          </p>
          {snap.sessions.map((s) => (
            <Card key={s.id} className="border-0 shadow-soft">
              <CardContent className="space-y-3 p-4">
                <div>
                  <div className="text-base font-bold text-primary-deep">
                    {s.courseName}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      ({s.index}. Termin)
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-4 w-4" />
                      {WEEKDAYS[new Date(`${s.date}T12:00:00Z`).getUTCDay()]},{" "}
                      {formatDateBerlin(s.date)}
                      {s.start ? ` · ${s.start}${s.end ? `–${s.end}` : ""} Uhr` : ""}
                    </span>
                    {s.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {s.location}
                      </span>
                    )}
                    {s.team.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        Mit {s.team.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                {s.participants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Teilnehmenden gespeichert.</p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {s.participants.map((p) => {
                      const cur = marks[`${s.id}|${p.id}`] ?? null;
                      return (
                        <li key={p.id} className="space-y-2 p-3">
                          <div className="font-medium">{p.name}</div>
                          {p.hint && (
                            <div className="whitespace-pre-line rounded bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                              {p.hint}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {OPTIONS.map((o) => (
                              <Button
                                key={o.value}
                                size="sm"
                                type="button"
                                className="min-h-11 flex-1 sm:flex-none"
                                aria-pressed={cur === o.value}
                                variant={cur === o.value ? "default" : "outline"}
                                onClick={() => void mark(s.id, p.id, o.value)}
                              >
                                {o.label}
                              </Button>
                            ))}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
