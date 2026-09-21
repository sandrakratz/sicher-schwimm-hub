import { createFileRoute } from "@tanstack/react-router";
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
import { ParticipantCard } from "@/components/trainer/ParticipantCard";
import { buildBeltNumbers } from "@/lib/trainer-belt-no";
import { PhoneEditor } from "@/components/trainer/PhoneEditor";
import { ParticipantResultEditor, type ParticipantResult } from "@/components/trainer/ParticipantResultEditor";


export const Route = createFileRoute("/_authenticated/trainer/kurse")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/admin-guard.functions");
    const { redirect } = await import("@tanstack/react-router");
    try { await assertHasAnyRole({ data: { roles: ["admin", "board", "trainer"] } }); }
    catch { throw redirect({ to: "/portal" }); }
  },
  component: Page,
  head: () => ({
    meta: [
      { title: "Meine Kurse – Trainerbereich | Sicher Schwimmen e.V." },
      { name: "description", content: "Teilnehmerinformationen zu den eigenen zugeteilten Kursen." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Bestätigt",
  waiting: "Warteliste",
  cancelled: "Storniert",
};

function Page() {
  const [courses, setCourses] = useState<TrainerCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useServerFn(listMyTrainerCourses);

  const applyPhone = (participantId: string, phone: string | null) => {
    setCourses(prev =>
      prev.map(c => ({
        ...c,
        participants: c.participants.map(p => (p.id === participantId ? { ...p, phone } : p)),
      })),
    );
  };

  const applyResult = (participantId: string, result: ParticipantResult) => {
    setCourses(prev =>
      prev.map(c => ({
        ...c,
        participants: c.participants.map(p => (p.id === participantId ? { ...p, ...result } : p)),
      })),
    );
  };

  const exportProtocol = useServerFn(exportExamProtocol);
  const [exporting, setExporting] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Meine Kurse</h1>
        <p className="text-sm text-muted-foreground">
          Teilnehmerinformationen zu den Kursen, in denen du eingeteilt bist.
        </p>
      </div>

      {loading && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Lädt…</CardContent></Card>
      )}

      {!loading && courses.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Du bist aktuell keinem Kurs zugeteilt.
        </CardContent></Card>
      )}

      {courses.map((c, i) => {
        const beltNo = buildBeltNumbers(c.participants);
        return (
        <CollapsibleCard
          key={c.id}
          defaultOpen={i === 0}
          storageKey={`trainer-kurs-${c.id}`}
          title={c.name}
          subtitle={[c.location, c.schedule, c.starts_on ? `ab ${formatDateBerlin(c.starts_on)}` : null].filter(Boolean).join(" · ")}
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
            </div>

            {/* Anwesenheit an einer Stelle: Kinder und eigener Nachweis als Reiter */}
            <div className="space-y-2 px-4 pb-4 sm:px-6">
              <h3 className="text-sm font-semibold">Anwesenheit</h3>
              <Tabs defaultValue="kinder">
                <TabsList>
                  <TabsTrigger value="kinder">Teilnehmende</TabsTrigger>
                  <TabsTrigger value="trainer">Meine Anwesenheit</TabsTrigger>
                </TabsList>
                <TabsContent value="kinder" className="mt-3">
                  <p className="mb-2 text-xs text-muted-foreground">
                    Tipp: Auf den Namen tippen, um Geburtsdatum, Kontakt der Eltern und den Prüfungsnachweis zu öffnen.
                  </p>
                  <AttendanceBoard
                    courseId={c.id}
                    participants={c.participants
                      .filter(p => p.status !== "cancelled")
                      .map(p => ({ id: p.id, name: p.name || "—", no: beltNo.get(p.id) ?? null }))}
                    renderDetails={id => {
                      const p = c.participants.find(x => x.id === id);
                      if (!p) return null;
                      return (
                        <ParticipantDetails
                          p={p}
                          editablePhone
                          onPhoneSaved={applyPhone}
                          editableResult
                          onResultSaved={applyResult}
                        />
                      );
                    }}
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

            {c.participants.some(p => p.status === "cancelled") && (
              <div className="border-t pt-2">
                <h3 className="px-4 py-2 text-sm font-semibold text-muted-foreground">Stornierte Anmeldungen</h3>
                {c.participants
                  .filter(p => p.status === "cancelled")
                  .map(p => (
                    <ParticipantCard key={p.id} p={p} no={beltNo.get(p.id) ?? null} />
                  ))}
              </div>
            )}
        </CollapsibleCard>
        );
      })}
    </div>
  );
}
