import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyTrainerCourses,
  exportExamProtocol,
  type TrainerCourse,
} from "@/lib/trainer-courses.functions";
import { formatDateBerlin } from "@/lib/format";
import { toast } from "sonner";
import { AttendanceBoard } from "@/components/AttendanceBoard";
import { TrainerAttendancePanel } from "@/components/TrainerAttendancePanel";
import { ParticipantCard, ParticipantDetails } from "@/components/trainer/ParticipantCard";
import { buildBeltNumbers } from "@/lib/trainer-belt-no";
import { combineChildHint } from "@/lib/child-hint";
import { type ParticipantResult } from "@/components/trainer/ParticipantResultEditor";
import { MultiWatch } from "@/components/trainer/MultiWatch";
import { CourseBroadcastDialog } from "@/components/admin/CourseBroadcastDialog";
import { TransferParticipantDialog } from "@/components/admin/TransferParticipantDialog";
import { listTransferTargets } from "@/lib/participant-transfer.functions";
import {
  listFamilySwimForTrainers,
  type TrainerFamilySwimEvent,
} from "@/lib/familienschwimmen.functions";
import { FamilySwimDay } from "@/components/trainer/FamilySwimDay";

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const NO_DAY = 0;
/** So viele Tage vor Kursstart erscheint ein Kurs in der Tagesansicht. */
const UPCOMING_DAYS = 14;
const isoWeekday = (dateIso: string) =>
  new Date(`${dateIso.slice(0, 10)}T12:00:00Z`).getUTCDay() || 7;

export const Route = createFileRoute("/_authenticated/trainer/kurse")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board", "trainer"] } });
    } catch {
      throw redirect({ to: "/portal" });
    }
  },
  component: Page,
  head: () => ({
    meta: [
      { title: "Meine Kurse – Trainerbereich | Sicher Schwimmen e.V." },
      {
        name: "description",
        content: "Teilnehmerinformationen zu den eigenen zugeteilten Kursen.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function Page() {
  const [courses, setCourses] = useState<TrainerCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useServerFn(listMyTrainerCourses);
  const [swimEvents, setSwimEvents] = useState<TrainerFamilySwimEvent[]>([]);
  const [pickedDay, setPickedDay] = useState<number | null>(null);
  const loadSwim = useServerFn(listFamilySwimForTrainers);
  useEffect(() => {
    // Das Mitgliederschwimmen ist eine Zugabe: schlägt es fehl, bleiben die Kurse trotzdem nutzbar.
    loadSwim()
      .then(setSwimEvents)
      .catch(() => setSwimEvents([]));
  }, []);

  const applyPhone = (participantId: string, phone: string | null) => {
    setCourses((prev) =>
      prev.map((c) => ({
        ...c,
        participants: c.participants.map((p) => (p.id === participantId ? { ...p, phone } : p)),
      })),
    );
  };

  const applyResult = (participantId: string, result: ParticipantResult) => {
    setCourses((prev) =>
      prev.map((c) => ({
        ...c,
        participants: c.participants.map((p) => (p.id === participantId ? { ...p, ...result } : p)),
      })),
    );
  };

  const applyBelt = (participantId: string, blocks: number | null) => {
    setCourses((prev) =>
      prev.map((c) => ({
        ...c,
        participants: c.participants.map((p) =>
          p.id === participantId ? { ...p, belt_blocks: blocks } : p,
        ),
      })),
    );
  };

  const exportProtocol = useServerFn(exportExamProtocol);
  const [exporting, setExporting] = useState<string | null>(null);
  const [broadcast, setBroadcast] = useState<{ id: string; name: string } | null>(null);
  const [transferPart, setTransferPart] = useState<{
    id: string;
    participant_name: string | null;
    participant_email: string | null;
    course_id: string;
  } | null>(null);
  const [targets, setTargets] = useState<
    Array<{
      id: string;
      name: string;
      schedule: string | null;
      location: string | null;
      free: number | null;
    }>
  >([]);
  const loadTargets = useServerFn(listTransferTargets);
  useEffect(() => {
    if (transferPart && targets.length === 0) {
      loadTargets()
        .then(setTargets)
        .catch((e) => toast.error((e as Error)?.message || "Kurse konnten nicht geladen werden"));
    }
  }, [transferPart]);

  // Prüfungsprotokoll nach DPO als PDF für die Vereinsakte herunterladen.
  async function downloadProtocol(courseId: string) {
    setExporting(courseId);
    try {
      const res = await exportProtocol({ data: { courseId } });
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Export fehlgeschlagen");
    } finally {
      setExporting(null);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        setCourses(await load());
      } catch (e: unknown) {
        toast.error((e as Error)?.message || "Laden fehlgeschlagen");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Erledigt: Kurs abgelaufen oder keine aktiven Teilnehmenden
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
  const isDone = (c: TrainerCourse) =>
    (c.ends_on != null && c.ends_on.slice(0, 10) < today) ||
    !c.participants.some((p) => p.status !== "cancelled");
  // Kurse, die erst in mehr als 14 Tagen beginnen, brauchen noch keinen Platz in der Tagesansicht.
  const soonLimit = new Date(`${today}T12:00:00Z`);
  soonLimit.setUTCDate(soonLimit.getUTCDate() + UPCOMING_DAYS);
  const soonIso = soonLimit.toISOString().slice(0, 10);
  const isLater = (c: TrainerCourse) => c.starts_on != null && c.starts_on.slice(0, 10) > soonIso;
  const ownCourses = courses.filter((c) => !isDone(c) && !c.supporting);
  const activeCourses = ownCourses.filter((c) => !isLater(c));
  const laterCourses = ownCourses.filter(isLater);
  const doneCourses = courses.filter((c) => isDone(c) && !c.supporting);
  // Vorstand/Verwaltung: weitere laufende Kurse ohne Einteilung, eingeklappt in einer eigenen Rubrik
  const supportCourses = courses.filter((c) => c.supporting && !isDone(c));

  // Ebene 1: Wochentage. Erst ein Tipp auf den Tag zeigt die Kurse und das Mitgliederschwimmen dieses Tages.
  const days = [1, 2, 3, 4, 5, 6, 7, NO_DAY]
    .map((wd) => ({
      wd,
      courses: activeCourses.filter((c) =>
        wd === NO_DAY ? c.weekdays.length === 0 : c.weekdays.includes(wd),
      ),
      swim: swimEvents.filter((e) => wd !== NO_DAY && isoWeekday(e.event_date) === wd),
    }))
    .filter((d) => d.courses.length > 0 || d.swim.length > 0);
  const todayWd = isoWeekday(today);
  const selectedDay = (
    days.find((d) => d.wd === pickedDay) ??
    days.find((d) => d.wd === todayWd) ??
    days[0]
  )?.wd;
  const day = days.find((d) => d.wd === selectedDay);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Meine Kurse</h1>
        <p className="text-sm text-muted-foreground">
          Teilnehmerinformationen zu den Kursen, in denen du eingeteilt bist.
        </p>
      </div>

      {loading && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Lädt…</CardContent>
        </Card>
      )}

      {!loading && courses.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Du bist aktuell keinem Kurs zugeteilt.
          </CardContent>
        </Card>
      )}

      <CourseBroadcastDialog course={broadcast} onClose={() => setBroadcast(null)} />

      <TransferParticipantDialog
        participant={transferPart}
        courses={targets.filter((t) => t.id !== transferPart?.course_id)}
        onClose={() => setTransferPart(null)}
        onDone={async () => {
          setTransferPart(null);
          setCourses(await load());
        }}
      />

      {days.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {days.map((d) => (
            <button
              key={d.wd}
              type="button"
              onClick={() => setPickedDay(d.wd)}
              aria-pressed={d.wd === selectedDay}
              className={`min-h-14 rounded-lg border p-3 text-left transition-colors ${
                d.wd === selectedDay ? "border-primary bg-primary/10" : "hover:bg-muted"
              }`}
            >
              <div className="font-semibold">
                {d.wd === NO_DAY ? "Ohne festen Tag" : WEEKDAYS[d.wd - 1]}
                {d.wd === todayWd && <span className="ml-1 text-xs text-primary">heute</span>}
              </div>
              <div className="text-xs text-muted-foreground">
                {d.courses.length} {d.courses.length === 1 ? "Kurs" : "Kurse"}
                {d.swim.length > 0 && " · Mitgliederschwimmen"}
              </div>
            </button>
          ))}
        </div>
      )}

      {day && (
        <div className="space-y-4">
          {day.swim.map((e) => (
            <FamilySwimDay key={e.id} event={e} open={e.event_date === today} />
          ))}
          {day.courses.map((c, i) => renderCourse(c, i === 0 && day.swim.length === 0))}
        </div>
      )}

      {laterCourses.length > 0 && (
        <CollapsibleCard
          storageKey="trainer-kurse-spaeter"
          title="Demnächst startende Kurse"
          subtitle={`Beginnen erst in mehr als ${UPCOMING_DAYS} Tagen – erscheinen dann automatisch unter dem Wochentag`}
          meta={<Badge variant="outline">{laterCourses.length}</Badge>}
        >
          <div className="space-y-4 px-4 pb-4 sm:px-6">
            {laterCourses.map((c) => renderCourse(c, false))}
          </div>
        </CollapsibleCard>
      )}

      {supportCourses.length > 0 && (
        <CollapsibleCard
          storageKey="trainer-kurse-unterstuetzung"
          title="Weitere laufende Kurse"
          subtitle="Hier bist du nicht eingeteilt – zum Aushelfen kannst du trotzdem Anwesenheit melden und Fortschritte eintragen"
          meta={<Badge variant="outline">{supportCourses.length}</Badge>}
        >
          <div className="space-y-4 px-4 pb-4 sm:px-6">
            {supportCourses.map((c) => renderCourse(c, false))}
          </div>
        </CollapsibleCard>
      )}

      {doneCourses.length > 0 && (
        <CollapsibleCard
          storageKey="trainer-kurse-erledigt"
          title="Erledigte Kurse"
          subtitle="Abgelaufene Kurse und Kurse ohne Teilnehmende"
          meta={<Badge variant="outline">{doneCourses.length}</Badge>}
        >
          <div className="space-y-4 px-4 pb-4 sm:px-6">
            {doneCourses.map((c) => renderCourse(c, false))}
          </div>
        </CollapsibleCard>
      )}
    </div>
  );

  function renderCourse(c: TrainerCourse, open: boolean) {
    const beltNo = buildBeltNumbers(c.participants);
    return (
      <CollapsibleCard
        key={c.id}
        defaultOpen={open}
        storageKey={`trainer-kurs-${c.id}`}
        title={c.name}
        subtitle={[
          c.location,
          c.schedule,
          c.starts_on ? `ab ${formatDateBerlin(c.starts_on)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        meta={<Badge variant="secondary">{c.participants.length} Teilnehmende</Badge>}
        contentClassName="px-0"
      >
        <div className="px-4 pb-2 sm:px-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadProtocol(c.id)}
            disabled={exporting === c.id}
          >
            {exporting === c.id ? "Erstellt…" : "Prüfungsprotokoll (PDF)"}
          </Button>
          <Button variant="outline" size="sm" className="ml-2" asChild>
            <Link to="/trainer/abzeichen/$courseId" params={{ courseId: c.id }}>
              Abzeichen vorbereiten
            </Link>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="ml-2"
            onClick={() => setBroadcast({ id: c.id, name: c.name })}
          >
            📢 Eilnachricht an alle Eltern
          </Button>
        </div>

        {/* Anwesenheit an einer Stelle: Kinder und eigener Nachweis als Reiter */}
        <div className="space-y-2 px-4 pb-4 sm:px-6">
          <h3 className="text-sm font-semibold">Anwesenheit &amp; Zeitnahme</h3>
          <Tabs defaultValue="kinder">
            <TabsList>
              <TabsTrigger value="kinder">Teilnehmende</TabsTrigger>
              <TabsTrigger value="zeitnahme">Zeitnahme</TabsTrigger>
              <TabsTrigger value="trainer">Meine Anwesenheit</TabsTrigger>
            </TabsList>
            <TabsContent value="kinder" className="mt-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Tipp: Auf den Namen tippen, um Geburtsdatum, Kontakt der Eltern und den
                Prüfungsnachweis zu öffnen.
              </p>
              <AttendanceBoard
                courseId={c.id}
                participants={c.participants
                  .filter((p) => p.status !== "cancelled")
                  .map((p) => ({
                    id: p.id,
                    name: p.name || "—",
                    no: beltNo.get(p.id) ?? null,
                    hint: combineChildHint(p.notes, p.health_info),
                    paid: p.paid,
                  }))}
                editableHints
                onHintSaved={(id, hint) =>
                  setCourses((prev) =>
                    prev.map((cc) => ({
                      ...cc,
                      participants: cc.participants.map((pp) =>
                        pp.id === id ? { ...pp, notes: hint } : pp,
                      ),
                    })),
                  )
                }
                renderDetails={(id) => {
                  const p = c.participants.find((x) => x.id === id);
                  if (!p) return null;
                  return (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mb-2 min-h-11"
                        onClick={() =>
                          setTransferPart({
                            id: p.id,
                            participant_name: p.name,
                            participant_email: p.email,
                            course_id: c.id,
                          })
                        }
                      >
                        ↔ Kind umbuchen
                      </Button>
                      <ParticipantDetails
                        p={p}
                        editablePhone
                        onPhoneSaved={applyPhone}
                        editableResult
                        onResultSaved={applyResult}
                        onBeltSaved={applyBelt}
                      />
                    </>
                  );
                }}
              />
            </TabsContent>
            <TabsContent value="zeitnahme" className="mt-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Bis zu 4 Kinder gleichzeitig stoppen und die Bahnen je Lage zählen.
              </p>
              <MultiWatch
                location={c.location}
                participants={c.participants
                  .filter((p) => p.status !== "cancelled")
                  .map((p) => ({
                    id: p.id,
                    name: p.name || "—",
                    no: beltNo.get(p.id) ?? null,
                    result: {
                      goal_reached: p.goal_reached,
                      badge: p.badge,
                      achievement: p.achievement,
                      exam_level: p.exam_level,
                      exam_criteria: p.exam_criteria,
                      exam_date: p.exam_date,
                      exam_pass_no: p.exam_pass_no,
                    },
                  }))}
                onSaved={applyResult}
              />
            </TabsContent>
            <TabsContent value="trainer" className="mt-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Dein eigener Nachweis für die Übungsleiterpauschale.
              </p>
              <TrainerAttendancePanel courseId={c.id} />
            </TabsContent>
          </Tabs>
        </div>

        {c.participants.some((p) => p.status === "cancelled") && (
          <div className="border-t pt-2">
            <h3 className="px-4 py-2 text-sm font-semibold text-muted-foreground">
              Stornierte Anmeldungen
            </h3>
            {c.participants
              .filter((p) => p.status === "cancelled")
              .map((p) => (
                <ParticipantCard key={p.id} p={p} no={beltNo.get(p.id) ?? null} />
              ))}
          </div>
        )}
      </CollapsibleCard>
    );
  }
}
