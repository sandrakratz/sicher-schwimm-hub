import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  FamilySwimDay,
  FamilySwimUpcoming,
  type AttendanceSaved,
} from "@/components/trainer/FamilySwimDay";

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
  // Gewählter Kurs (ID) oder Mitgliederschwimmen („swim:<ID>“); ohne Wahl: der nächste Kurs
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const loadSwim = useServerFn(listFamilySwimForTrainers);
  // Nach dem Speichern der Anwesenheit die Liste lokal nachziehen (ohne Neuladen).
  const applyAttendance: AttendanceSaved = (requestId, presentKeys) =>
    setSwimEvents((prev) =>
      prev.map((e) => ({
        ...e,
        groups: e.groups.map((g) =>
          g.id !== requestId
            ? g
            : {
                ...g,
                status: presentKeys.length ? "attended" : "no_show",
                persons: g.persons.map((p) => ({ ...p, present: presentKeys.includes(p.key) })),
              },
        ),
      })),
    );
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

  // Mitgliederschwimmen: ohne Zusagen irrelevant (ausgeblendet); weiter als 14 Tage entfernt → Sammelkarte.
  const swimWithSeats = swimEvents.filter((e) => e.groups.length > 0);
  const swimSoon = swimWithSeats.filter((e) => e.event_date <= soonIso);
  const swimLater = swimWithSeats.filter((e) => e.event_date > soonIso);

  // Eine Ebene: oben den Kurs (oder das Mitgliederschwimmen) wählen, darunter steht alles dazu.
  // Laufende Kurse mit heutigem Wochentag zuerst, weitere Kurse über die Auswahl „Weitere Kurse“.
  const todayWd = isoWeekday(today);
  const dayOf = (c: TrainerCourse) =>
    c.weekdays.length === 0 ? NO_DAY : (c.weekdays.find((w) => w >= todayWd) ?? c.weekdays[0]);
  const chips: Array<
    | { key: string; kind: "course"; course: TrainerCourse; label: string; today: boolean }
    | { key: string; kind: "swim"; event: TrainerFamilySwimEvent; label: string; today: boolean }
  > = [
    ...swimSoon.map((e) => ({
      key: `swim:${e.id}`,
      kind: "swim" as const,
      event: e,
      label: `Mitgliederschwimmen · ${formatDateBerlin(e.event_date)}`,
      today: e.event_date === today,
    })),
    ...activeCourses.map((c) => ({
      key: c.id,
      kind: "course" as const,
      course: c,
      label: `${c.name}${c.weekdays.length ? ` · ${c.weekdays.map((w) => WEEKDAYS[w - 1].slice(0, 2)).join("/")}` : ""}`,
      today: c.weekdays.includes(todayWd),
    })),
  ].sort(
    (a, b) =>
      Number(b.today) - Number(a.today) ||
      (a.kind === "course" && b.kind === "course"
        ? ((dayOf(a.course) - todayWd + 7) % 7) - ((dayOf(b.course) - todayWd + 7) % 7)
        : 0),
  );
  const more: Array<{ label: string; list: TrainerCourse[] }> = [
    { label: `Beginnen in mehr als ${UPCOMING_DAYS} Tagen`, list: laterCourses },
    { label: "Zum Aushelfen (nicht eingeteilt)", list: supportCourses },
    { label: "Erledigt", list: doneCourses },
  ].filter((g) => g.list.length > 0);
  const allCourses = [...activeCourses, ...laterCourses, ...supportCourses, ...doneCourses];
  const selectedKey =
    (pickedKey &&
    (chips.some((c) => c.key === pickedKey) || allCourses.some((c) => c.id === pickedKey))
      ? pickedKey
      : null) ??
    chips[0]?.key ??
    null;
  const selectedChip = chips.find((c) => c.key === selectedKey) ?? null;
  const selectedCourse =
    selectedChip?.kind === "course"
      ? selectedChip.course
      : (allCourses.find((c) => c.id === selectedKey) ?? null);
  const selectedSwim = selectedChip?.kind === "swim" ? selectedChip.event : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Kurse &amp; Anwesenheit</h1>
        <p className="text-sm text-muted-foreground">
          Kurs wählen – darunter Anwesenheit, Zeitnahme, Ergebnisse und deine eigene Anwesenheit.
        </p>
      </div>

      {loading && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Lädt…</CardContent>
        </Card>
      )}

      {!loading && courses.length === 0 && swimWithSeats.length === 0 && (
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

      {(chips.length > 0 || more.length > 0) && (
        <div className="space-y-2">
          <div role="group" aria-label="Kurs wählen" className="flex gap-2 overflow-x-auto pb-1">
            {chips.map((c) => {
              const on = c.key === selectedKey;
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPickedKey(c.key)}
                  className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors ${
                    on
                      ? "border-primary-deep bg-primary-deep text-white"
                      : "border-border bg-card hover:border-primary"
                  }`}
                >
                  {c.label}
                  {c.today && (
                    <span className={`ml-1 text-xs ${on ? "text-accent" : "text-primary"}`}>
                      heute
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {more.length > 0 && (
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Weitere Kurse:</span>
              <select
                className="h-11 rounded-md border bg-background px-3 text-sm"
                value={chips.some((c) => c.key === selectedKey) ? "" : (selectedKey ?? "")}
                onChange={(e) => e.target.value && setPickedKey(e.target.value)}
              >
                <option value="">Bitte wählen …</option>
                {more.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.list.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.starts_on ? ` · ab ${formatDateBerlin(c.starts_on)}` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {selectedSwim && (
        <FamilySwimDay key={selectedSwim.id} event={selectedSwim} open onSaved={applyAttendance} />
      )}
      {selectedCourse && renderCourse(selectedCourse)}

      {swimLater.length > 0 && <FamilySwimUpcoming events={swimLater} onSaved={applyAttendance} />}
    </div>
  );

  function renderCourse(c: TrainerCourse) {
    const beltNo = buildBeltNumbers(c.participants);
    return (
      <Card key={c.id} className="border-0 shadow-soft">
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-primary-deep">{c.name}</h2>
              <p className="text-sm text-muted-foreground">
                {[
                  c.location,
                  c.schedule,
                  c.starts_on ? `ab ${formatDateBerlin(c.starts_on)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <Badge variant="secondary">{c.participants.length} Teilnehmende</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadProtocol(c.id)}
              disabled={exporting === c.id}
            >
              {exporting === c.id ? "Erstellt…" : "Prüfungsprotokoll (PDF)"}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/trainer/abzeichen/$courseId" params={{ courseId: c.id }}>
                Abzeichen vorbereiten
              </Link>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBroadcast({ id: c.id, name: c.name })}
            >
              Eilnachricht an alle Eltern
            </Button>
          </div>

          <Tabs defaultValue="kinder">
            <TabsList>
              <TabsTrigger value="kinder">Anwesenheit</TabsTrigger>
              <TabsTrigger value="zeitnahme">Zeitnahme</TabsTrigger>
              <TabsTrigger value="trainer">Meine Anwesenheit</TabsTrigger>
            </TabsList>
            <TabsContent value="kinder" className="mt-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Tipp: Auf den Namen tippen, um Geburtsdatum, Kontakt der Eltern, Ergebnisse und den
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
                        Kind umbuchen
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

          {c.participants.some((p) => p.status === "cancelled") && (
            <details className="border-t pt-2">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-muted-foreground">
                Stornierte Anmeldungen (
                {c.participants.filter((p) => p.status === "cancelled").length})
              </summary>
              {c.participants
                .filter((p) => p.status === "cancelled")
                .map((p) => (
                  <ParticipantCard key={p.id} p={p} no={beltNo.get(p.id) ?? null} />
                ))}
            </details>
          )}
        </CardContent>
      </Card>
    );
  }
}
