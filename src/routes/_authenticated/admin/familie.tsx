import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldBan } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFamilyOverview, type FamilyEvent } from "@/lib/family.functions";
import { resolveBlockSuggestion } from "@/lib/waitlist.functions";
import { formatDateBerlin, formatDateTimeBerlin } from "@/lib/format";

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

const ENTRY_STATUS: Record<string, string> = {
  waiting: "Wartend",
  offered: "Platz angeboten",
  accepted: "Zugesagt",
  declined: "Abgesagt",
  expired: "Frist abgelaufen",
  removed: "Entfernt",
};
const BOOKING_STATUS: Record<string, string> = {
  confirmed: "Gebucht",
  waiting: "Warteliste",
  cancelled: "Abgesagt / storniert",
};
const EVENT_STYLE: Record<FamilyEvent["kind"], string> = {
  request: "bg-slate-100 text-slate-800",
  waitlist: "bg-amber-100 text-amber-900",
  booking: "bg-emerald-100 text-emerald-900",
  payment: "bg-emerald-100 text-emerald-900",
  cancel: "bg-red-100 text-red-900",
  mail: "bg-sky-100 text-sky-900",
  block: "bg-red-100 text-red-900",
  note: "bg-muted text-foreground",
};
const EVENT_LABEL: Record<FamilyEvent["kind"], string> = {
  request: "Anfrage",
  waitlist: "Anfrageliste",
  booking: "Buchung",
  payment: "Zahlung",
  cancel: "Absage",
  mail: "E-Mail",
  block: "Sperrliste",
  note: "Notiz",
};

function FamilyPage() {
  const { email, name } = Route.useSearch();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-family", email ?? null, name ?? null],
    queryFn: () => getFamilyOverview({ data: { email: email ?? null, childName: name ?? null } }),
    enabled: !!email || !!name,
  });

  const block = useMutation({
    mutationFn: () =>
      resolveBlockSuggestion({
        data: {
          action: "block",
          email: email ?? null,
          childName: name ?? null,
          reason: `Vorstandsentscheidung (Absagen/Stornierungen: ${data?.declinesTotal ?? 0})`,
        },
      }),
    onSuccess: () => {
      toast.success("Auf die Sperrliste gesetzt");
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
          <div className="text-accent text-sm font-semibold uppercase tracking-wider">Familie</div>
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
          {!data.blocked && (
            <Button
              size="sm"
              variant="destructive"
              disabled={block.isPending}
              onClick={() => {
                if (
                  confirm(
                    "Diese Familie auf die Sperrliste setzen? Buchung und Anfrageliste sind dann gesperrt.",
                  )
                )
                  block.mutate();
              }}
            >
              Auf Sperrliste setzen
            </Button>
          )}
        </div>
      </div>

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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anfrageliste</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.entries.length === 0 && (
              <p className="text-muted-foreground">Keine Einträge auf der Anfrageliste.</p>
            )}
            {data.entries.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap justify-between gap-2 border-b pb-1 last:border-0"
              >
                <span>
                  <span className="font-medium">{e.child_name}</span>
                  <span className="text-muted-foreground"> · {e.program ?? "ohne Zuordnung"}</span>
                </span>
                <span className="flex gap-1">
                  <Badge variant="secondary">{ENTRY_STATUS[e.status] ?? e.status}</Badge>
                  {e.decline_count > 0 && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-900">
                      {e.decline_count}× abgesagt
                    </Badge>
                  )}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buchungen</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {data.bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Buchungen.</p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Kind</th>
                  <th className="py-2 pr-3">Kurs</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Zahlung</th>
                  <th className="py-2 pr-3">Gebucht am</th>
                </tr>
              </thead>
              <tbody>
                {data.bookings.map((b) => (
                  <tr key={b.id} className="border-b align-top">
                    <td className="py-2 pr-3 font-medium">{b.child_name ?? "–"}</td>
                    <td className="py-2 pr-3">{b.course}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="secondary">{BOOKING_STATUS[b.status] ?? b.status}</Badge>
                    </td>
                    <td className="py-2 pr-3">
                      {b.paid
                        ? `bezahlt${b.paid_at ? ` am ${formatDateBerlin(b.paid_at)}` : ""}`
                        : b.status === "cancelled"
                          ? "–"
                          : `offen${b.due ? ` (fällig ${formatDateBerlin(b.due)})` : ""}`}
                      {b.price != null && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {Number(b.price).toFixed(2).replace(".", ",")} €
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">{formatDateBerlin(b.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verlauf</CardTitle>
        </CardHeader>
        <CardContent>
          {data.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Ereignisse.</p>
          ) : (
            <ol className="space-y-3">
              {data.events.map((ev, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[9.5rem_6.5rem_1fr] items-start gap-3 text-sm"
                >
                  <span className="text-muted-foreground">
                    {ev.whenLabel ?? formatDateTimeBerlin(ev.at)}
                  </span>
                  <Badge variant="secondary" className={`justify-center ${EVENT_STYLE[ev.kind]}`}>
                    {EVENT_LABEL[ev.kind]}
                  </Badge>
                  <span>
                    <span className="font-medium">{ev.title}</span>
                    {ev.detail && (
                      <span className="block whitespace-pre-wrap text-muted-foreground">
                        {ev.detail}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
