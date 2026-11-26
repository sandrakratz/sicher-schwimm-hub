import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldBan } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FamilyTimeline } from "@/components/admin/FamilyTimeline";
import { getFamilyOverview } from "@/lib/family.functions";
import { resolveBlockSuggestion } from "@/lib/waitlist.functions";
import { formatDateBerlin } from "@/lib/format";
import { FamilyWaitlist } from "@/components/admin/familie/FamilyWaitlist";
import { FamilyBookings } from "@/components/admin/familie/FamilyBookings";
import { SubjectAccessButton } from "@/components/admin/familie/SubjectAccessButton";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import { MoreMenu } from "@/components/admin/MoreMenu";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/familie")({
  validateSearch: (search: Record<string, unknown>): { email?: string; name?: string } => ({
    ...(typeof search["email"] === "string" && search["email"] ? { email: search["email"] } : {}),
    ...(typeof search["name"] === "string" && search["name"] ? { name: search["name"] } : {}),
  }),
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board"] } });
    } catch {
      throw redirect({ to: "/admin/benutzer" });
    }
  },
  head: () => ({
    meta: [
      { title: "Familie – Verwaltung | Sicher Schwimmen e.V." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: FamilyPage,
});

function FamilyPage() {
  const { email, name } = Route.useSearch();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-family", email ?? null, name ?? null],
    queryFn: () => getFamilyOverview({ data: { email: email ?? null, childName: name ?? null } }),
    enabled: !!email || !!name,
  });

  const [blockOpen, setBlockOpen] = useState(false);
  const block = useMutation({
    mutationFn: (reason: string) =>
      resolveBlockSuggestion({
        data: {
          action: "block",
          email: email ?? null,
          childName: name ?? null,
          reason: `${reason} (Absagen/Stornierungen: ${data?.declinesTotal ?? 0})`,
        },
      }),
    onSuccess: () => {
      setBlockOpen(false);
      toast.success("Auf die Sperrliste gesetzt");
      qc.invalidateQueries({ queryKey: ["admin-family"] });
    },
    onError: (e: Error) => toast.error(e.message || "Aktion fehlgeschlagen"),
  });
  const dismiss = useMutation({
    mutationFn: () =>
      resolveBlockSuggestion({
        data: { action: "dismiss", email: email ?? null, childName: name ?? null },
      }),
    onSuccess: () => {
      toast.success("Sperrvorschlag ignoriert");
      qc.invalidateQueries({ queryKey: ["admin-family"] });
    },
    onError: (e: Error) => toast.error(e.message || "Aktion fehlgeschlagen"),
  });

  if (!email && !name) {
    return (
      <p className="text-muted-foreground">
        Keine Familie ausgewählt. Nutzen Sie die{" "}
        <Link to="/admin/suche" className="underline">
          Suche
        </Link>{" "}
        oder öffnen Sie eine Familie aus der Anfrageliste.
      </p>
    );
  }
  if (isLoading)
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Familie wird geladen…
      </div>
    );
  if (error || !data)
    return (
      <p className="text-destructive">
        Die Familie konnte nicht geladen werden:{" "}
        {(error as Error | null)?.message ?? "unbekannter Fehler"}
      </p>
    );

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-accent text-sm font-semibold uppercase tracking-wider">
            Familienakte
          </div>
          <h1 className="font-display text-3xl font-bold text-primary-deep">
            {data.parentName ?? data.children[0]?.name ?? email ?? name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.email}
            {data.phone ? ` · ${data.phone}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge
              variant="secondary"
              className={
                data.declinesTotal >= 3
                  ? "bg-red-100 text-red-900"
                  : data.declinesTotal > 0
                    ? "bg-amber-100 text-amber-900"
                    : ""
              }
            >
              {data.declinesTotal}× Absage/Stornierung
            </Badge>
            {data.blocked && (
              <Badge variant="destructive" className="gap-1">
                <ShieldBan className="h-3 w-3" /> Auf der Sperrliste
              </Badge>
            )}
            {data.blockSuggestion && (
              <Badge variant="secondary" className="bg-red-100 text-red-900">
                Sperrliste prüfen
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/warteliste">Zur Anfrageliste</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/sperrliste">Sperrliste</Link>
          </Button>
          {data.email && <SubjectAccessButton email={data.email} />}
          {data.blockSuggestion && (
            <Button
              size="sm"
              variant="outline"
              disabled={dismiss.isPending}
              onClick={() => dismiss.mutate()}
              title="Sperrvorschlag verwerfen; die Familie bleibt ungesperrt"
            >
              Sperrvorschlag ignorieren
            </Button>
          )}
          <MoreMenu
            label="Familie"
            items={
              data.blocked
                ? []
                : [
                    {
                      label: "Auf die Sperrliste setzen …",
                      hint: "Online-Buchung gesperrt, nur noch Anfragen zur Einzelfallprüfung",
                      destructive: true,
                      onSelect: () => setBlockOpen(true),
                    },
                  ]
            }
          />
        </div>
      </div>
      {blockOpen && (
        <ConfirmActionDialog
          title="Familie auf die Sperrliste setzen"
          consequence={
            <>
              Die Familie kann über die Webseite nicht mehr direkt buchen; ihre Angaben landen nur
              noch als Anfrage zur Einzelfallprüfung. Es geht keine E-Mail an die Familie. Die
              Sperre lässt sich unter Familien → Sperrliste aufheben und wird nach 2 Jahren
              automatisch gelöscht.
            </>
          }
          reason={{
            label: "Grund",
            placeholder: "z. B. wiederholt nicht erschienen",
            required: true,
          }}
          confirmLabel="Auf die Sperrliste setzen"
          destructive
          busy={block.isPending}
          onClose={() => setBlockOpen(false)}
          onConfirm={(r) => block.mutate(r)}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kinder</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.children.length === 0 && <p className="text-muted-foreground">Keine Angaben.</p>}
            {data.children.map((c) => (
              <div key={c.name} className="flex justify-between gap-2 border-b pb-1 last:border-0">
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">
                  {c.dob ? `geb. ${formatDateBerlin(c.dob)}` : ""}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Anfrageliste</CardTitle>
        </CardHeader>
        <CardContent>
          <FamilyWaitlist entryIds={data.entries.map((e) => e.id)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buchungen</CardTitle>
        </CardHeader>
        <CardContent>
          <FamilyBookings
            bookingIds={data.bookings.map((b) => b.id)}
            onChanged={() => void qc.invalidateQueries({ queryKey: ["admin-family"] })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verlauf</CardTitle>
        </CardHeader>
        <CardContent>
          <FamilyTimeline events={data.events} />
        </CardContent>
      </Card>
    </div>
  );
}
