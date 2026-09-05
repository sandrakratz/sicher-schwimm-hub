import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useServerFn } from "@tanstack/react-start";
import { listMyTrainerCourses, type TrainerCourse } from "@/lib/trainer-courses.functions";
import { formatDateBerlin } from "@/lib/format";
import { toast } from "sonner";

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

      {courses.map(c => (
        <CollapsibleCard
          key={c.id}
          storageKey={`trainer-kurs-${c.id}`}
          title={c.name}
          subtitle={[c.location, c.schedule, c.starts_on ? `ab ${formatDateBerlin(c.starts_on)}` : null].filter(Boolean).join(" · ")}
          meta={<Badge variant="secondary">{c.participants.length} Teilnehmende</Badge>}
          contentClassName="px-0"
        >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kind</TableHead>
                  <TableHead>Geburtsdatum</TableHead>
                  <TableHead>Kontakt Eltern</TableHead>
                  <TableHead>Hinweise</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Zahlung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.participants.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-muted-foreground">Noch keine Teilnehmenden.</TableCell></TableRow>
                )}
                {c.participants.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name || "—"}</TableCell>
                    <TableCell>{p.date_of_birth ? formatDateBerlin(p.date_of_birth) : "—"}</TableCell>
                    <TableCell className="text-xs">
                      <div>{p.email || "—"}</div>
                      <div className="text-muted-foreground">{p.phone || "—"}</div>
                    </TableCell>
                    <TableCell className="max-w-[16rem] whitespace-pre-wrap text-xs">{p.notes || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{STATUS_LABEL[p.status] || p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {p.paid ? (
                        <Badge className="border-transparent bg-green-600 text-white">bezahlt</Badge>
                      ) : (
                        <Badge className="border-transparent bg-amber-100 text-amber-900">offen</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="space-y-2 border-t px-6 py-4">
              <h3 className="text-sm font-semibold">Anwesenheit erfassen</h3>
              <AttendanceBoard
                courseId={c.id}
                participants={c.participants
                  .filter(p => p.status !== "cancelled")
                  .map(p => ({ id: p.id, name: p.name || "—" }))}
              />
            </div>
        </CollapsibleCard>

      ))}
    </div>
  );
}
