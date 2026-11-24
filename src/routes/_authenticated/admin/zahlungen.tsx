import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Euro } from "lucide-react";
import { MemberCheckPanel } from "@/components/admin/MemberCheckPanel";
import { formatEuro } from "@/lib/format";
import { effectiveAssignee, useAssignmentContext } from "@/components/admin/AssignControl";
import { NativeSelect } from "@/components/ui/native-select";
import {
  PaymentCard,
  dueOf,
  useOpenPayments,
  type PaymentRow,
} from "@/components/admin/payments/OpenPayments";

export const Route = createFileRoute("/_authenticated/admin/zahlungen")({
  ssr: false,
  // ?zustaendig=ich öffnet die Liste gefiltert auf die angemeldete Person (Link aus „Mir zugewiesen“)
  validateSearch: (search: Record<string, unknown>): { zustaendig?: "ich" } =>
    search["zustaendig"] === "ich" ? { zustaendig: "ich" } : {},
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board"] } });
    } catch {
      throw redirect({ to: "/portal" });
    }
  },
  component: Page,
  head: () => ({
    meta: [
      { title: "Offene Zahlungen – Adminbereich | Sicher Schwimmen e.V." },
      {
        name: "description",
        content: "Alle gebuchten Kurse mit offener Zahlung, sortiert nach Fälligkeit.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type SortKey = "due" | "last" | "first";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "due", label: "Fälligkeit" },
  { key: "last", label: "Nachname" },
  { key: "first", label: "Vorname" },
];

// Namen sind als „Vorname Nachname“ gespeichert: letztes Wort = Nachname, Rest = Vorname.
function nameParts(name: string | null): [string, string] {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [words[0] ?? "", words[0] ?? ""];
  return [words.slice(0, -1).join(" "), words[words.length - 1]];
}

function Page() {
  const pay = useOpenPayments();
  const { rows, loading } = pay;
  const [sortBy, setSortBy] = useState<SortKey>("due");
  const ctx = useAssignmentContext();
  const [who, setWho] = useState("");
  const { zustaendig } = Route.useSearch();
  useEffect(() => {
    if (zustaendig === "ich" && ctx.data?.me) setWho(ctx.data.me);
  }, [zustaendig, ctx.data?.me]);

  const sorted = useMemo(() => {
    const byDue = (a: PaymentRow, b: PaymentRow) => dueOf(a).getTime() - dueOf(b).getTime();
    const cmp = (x: string, y: string) => x.localeCompare(y, "de", { sensitivity: "base" });
    const copy = [...rows];
    if (sortBy === "due") return copy.sort(byDue);
    const key = sortBy === "last" ? 1 : 0;
    return copy.sort((a, b) => {
      const na = nameParts(a.participant_name);
      const nb = nameParts(b.participant_name);
      const other = 1 - key;
      return cmp(na[key], nb[key]) || cmp(na[other], nb[other]) || byDue(a, b);
    });
  }, [rows, sortBy]);
  const visible = (r: PaymentRow) => {
    if (who === "") return true;
    const e = effectiveAssignee(r.assigned_to, "payments", ctx.data?.rules);
    return who === "__none" ? !e : e === who;
  };
  const shownRows = sorted.filter(visible);
  const total = shownRows.reduce((s, r) => s + (Number(r.price_amount) || 0), 0);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-3xl font-bold text-primary-deep">Geld</h1>
        <p className="text-sm text-muted-foreground">
          Mitgliedschaften prüfen und offene Zahlungen nachverfolgen.
        </p>
      </header>
      <MemberCheckPanel onChanged={() => void pay.load()} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" /> Offene Zahlungen
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Alle gebuchten Kursplätze ohne Zahlungseingang. Nach „Bezahlt“ verschwindet der Eintrag
            hier und erscheint im Kurs ganz normal als bezahlt.
          </p>
          {!loading && (
            <p className="text-sm font-medium">
              {shownRows.length} offen · insgesamt {formatEuro(total)}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-sm text-muted-foreground">Zuständig:</span>
            <NativeSelect size="sm" value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">Alle</option>
              <option value="__none">Nicht zugewiesen</option>
              {(ctx.data?.staff ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                  {s === ctx.data?.me ? " (ich)" : ""}
                </option>
              ))}
            </NativeSelect>
            <span className="text-sm text-muted-foreground">Sortieren nach:</span>
            {SORT_OPTIONS.map((o) => (
              <Button
                key={o.key}
                size="sm"
                variant={sortBy === o.key ? "default" : "outline"}
                aria-pressed={sortBy === o.key}
                onClick={() => setSortBy(o.key)}
              >
                {o.label}
              </Button>
            ))}
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Lädt …</p>
      ) : shownRows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {who
              ? "Keine offenen Zahlungen für diese Auswahl."
              : "Keine offenen Zahlungen – alles bezahlt. 🎉"}
          </CardContent>
        </Card>
      ) : (
        shownRows.map((r) => <PaymentCard key={r.id} r={r} pay={pay} />)
      )}
    </div>
  );
}
