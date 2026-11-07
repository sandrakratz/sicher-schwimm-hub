import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCourseBadgePrep } from "@/lib/badge-prep.functions";
import type { CourseBadgePrep } from "@/lib/badge-prep.server";
import { formatDateBerlin } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/trainer/abzeichen/$courseId")({
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
      { title: "Abzeichen vorbereiten – Trainerbereich | Sicher Schwimmen e.V." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function Page() {
  const { courseId } = Route.useParams();
  const load = useServerFn(getCourseBadgePrep);
  const [data, setData] = useState<CourseBadgePrep | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setData(await load({ data: { courseId } }));
      } catch (e: unknown) {
        toast.error((e as Error)?.message || "Laden fehlgeschlagen");
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId]);

  if (loading) {
    return <p className="py-10 text-center text-muted-foreground">Lädt…</p>;
  }
  if (!data) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Der Kurs wurde nicht gefunden oder du bist ihm nicht zugeteilt.
        </CardContent>
      </Card>
    );
  }

  const { course, ready, siggi } = data;
  // Gruppiert nach Abzeichen, Reihenfolge wie vom Server sortiert
  const groups: Array<{ label: string; rows: typeof ready }> = [];
  for (const r of ready) {
    const g = groups.find((x) => x.label === r.label);
    if (g) g.rows.push(r);
    else groups.push({ label: r.label, rows: [r] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Abzeichen vorbereiten</h1>
          <p className="text-sm text-muted-foreground">
            {course.name}
            {course.location ? ` · ${course.location}` : ""}
            {course.last_session
              ? ` · letzte Stunde am ${formatDateBerlin(course.last_session)}`
              : ""}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            Drucken
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/trainer/kurse">Zu meinen Kursen</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="py-3 text-sm">
          Stand von jetzt. Wenn in der letzten Stunde noch jemand ein Abzeichen schafft, nimm dafür
          bitte <strong>2–3 Blanko-Abzeichen</strong> mit.
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            Abzeichen ausstellen <Badge variant="secondary">{ready.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Noch kein Kind hat ein Abzeichen geschafft.
            </p>
          )}
          {groups.map((g) => (
            <div key={g.label}>
              <h3 className="mb-1 font-semibold">
                {g.label} <span className="text-muted-foreground">({g.rows.length})</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-1 pr-3 font-medium">Name</th>
                      <th className="py-1 pr-3 font-medium">Geburtsdatum</th>
                      <th className="py-1 font-medium">Geschafft am</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-1 pr-3">{r.name}</td>
                        <td className="py-1 pr-3">
                          {r.date_of_birth ? formatDateBerlin(r.date_of_birth) : "—"}
                        </td>
                        <td className="py-1">{r.date ? formatDateBerlin(r.date) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            Siggi-Pass <Badge variant="secondary">{siggi.length}</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Diese Kinder haben noch kein Abzeichen geschafft und bekommen den Siggi-Pass.
          </p>
        </CardHeader>
        <CardContent>
          {siggi.length === 0 ? (
            <p className="text-sm text-muted-foreground">Alle Kinder haben ein Abzeichen.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1 pr-3 font-medium">Name</th>
                    <th className="py-1 pr-3 font-medium">Geburtsdatum</th>
                    <th className="py-1 font-medium">Stand</th>
                  </tr>
                </thead>
                <tbody>
                  {siggi.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-1 pr-3">{r.name}</td>
                      <td className="py-1 pr-3">
                        {r.date_of_birth ? formatDateBerlin(r.date_of_birth) : "—"}
                      </td>
                      <td className="py-1 text-muted-foreground">{r.progress ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
