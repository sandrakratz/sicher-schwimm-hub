import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Euro } from "lucide-react";
import { formatDateBerlin } from "@/lib/format";
import { paymentState, paymentTerms } from "@/lib/payment-status";
import {
  AssignControl,
  effectiveAssignee,
  useAssignmentContext,
} from "@/components/admin/AssignControl";

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

type Row = {
  id: string;
  participant_name: string | null;
  participant_email: string | null;
  participant_phone: string | null;
  price_amount: number | null;
  payment_note: string | null;
  payment_method: string | null;
  payment_due_date: string | null;
  assigned_to: string | null;
  created_at: string;
  courses: {
    name: string;
    starts_on: string | null;
    ends_on: string | null;
    payment_due_days: number | null;
    location: string | null;
  } | null;
};

function dueOf(r: Row): Date {
  if (r.payment_due_date) return new Date(`${r.payment_due_date}T23:59:59`);
  return paymentTerms({
    bookedAt: r.created_at,
    startsOn: r.courses?.starts_on,
    paymentDueDays: r.courses?.payment_due_days,
  }).dueDate;
}

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
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("due");
  const ctx = useAssignmentContext();
  const [who, setWho] = useState("");
  const { zustaendig } = Route.useSearch();
  useEffect(() => {
    if (zustaendig === "ich" && ctx.data?.me) setWho(ctx.data.me);
  }, [zustaendig, ctx.data?.me]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("course_participants")
      .select(
        "id,participant_name,participant_email,participant_phone,assigned_to,price_amount,payment_note,payment_method,payment_due_date,created_at,courses!course_participants_course_id_fkey(name,starts_on,ends_on,payment_due_days,location)",
      )
      .eq("status", "confirmed")
      .eq("paid", false);
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data ?? []) as unknown as Row[]);
  }
  useEffect(() => {
    load();
  }, []);

  const sorted = useMemo(() => {
    const byDue = (a: Row, b: Row) => dueOf(a).getTime() - dueOf(b).getTime();
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
  const visible = (r: Row) => {
    if (who === "") return true;
    const e = effectiveAssignee(r.assigned_to, "payments", ctx.data?.rules);
    return who === "__none" ? !e : e === who;
  };
  const shownRows = sorted.filter(visible);
  const total = shownRows.reduce((s, r) => s + (Number(r.price_amount) || 0), 0);

  async function undoPaid(r: Row) {
    const { error } = await supabase
      .from("course_participants")
      .update({
        paid: false,
        paid_at: null,
        paid_by: null,
        payment_note: r.payment_note,
      })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.info(`Zahlung von ${r.participant_name ?? "Teilnehmer"} wieder auf „offen“ gesetzt`);
    await load();
  }

  async function markPaid(r: Row) {
    setBusy(r.id);
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const note = notes[r.id]?.trim();
    const { error } = await supabase
      .from("course_participants")
      .update({
        paid: true,
        paid_at: new Date().toISOString(),
        paid_by: userId,
        ...(note ? { payment_note: r.payment_note ? `${r.payment_note}\n${note}` : note } : {}),
      })
      .eq("id", r.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    setRows((rs) => rs.filter((x) => x.id !== r.id));
    // Fehlklick abfangen: kurz Zeit zum Rückgängigmachen
    toast.success(`${r.participant_name ?? "Teilnehmer"} als bezahlt markiert`, {
      duration: 10000,
      action: { label: "Rückgängig", onClick: () => void undoPaid(r) },
    });
  }

  return (
    <div className="space-y-4">
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
              {shownRows.length} offen · insgesamt {total.toFixed(2).replace(".", ",")} €
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-sm text-muted-foreground">Zuständig:</span>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={who}
              onChange={(e) => setWho(e.target.value)}
            >
              <option value="">Alle</option>
              <option value="__none">Nicht zugewiesen</option>
              {(ctx.data?.staff ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                  {s === ctx.data?.me ? " (ich)" : ""}
                </option>
              ))}
            </select>
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
        shownRows.map((r) => {
          const st = paymentState({
            paid: false,
            bookedAt: r.created_at,
            startsOn: r.courses?.starts_on,
            paymentDueDays: r.courses?.payment_due_days,
            method: r.payment_method,
            dueDate: r.payment_due_date,
          });
          return (
            <Card key={r.id}>
              <CardContent className="py-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.participant_name ?? "–"}</span>
                    <Badge variant="outline" className={st.className}>
                      {st.label}
                    </Badge>
                    <span className="text-sm">fällig {formatDateBerlin(dueOf(r))}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {r.courses?.name ?? "Kurs"}
                    {r.courses?.starts_on &&
                      ` · ${formatDateBerlin(r.courses.starts_on)}${r.courses.ends_on ? ` – ${formatDateBerlin(r.courses.ends_on)}` : ""}`}
                    {r.courses?.location && ` · ${r.courses.location}`}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {r.participant_email}
                    {r.participant_phone && ` · ${r.participant_phone}`}
                  </div>
                  <div className="text-xs text-muted-foreground">{st.detail}</div>
                  {r.payment_note && (
                    <div className="text-xs whitespace-pre-line">Notiz: {r.payment_note}</div>
                  )}
                </div>
                <AssignControl
                  kind="payment"
                  id={r.id}
                  area="payments"
                  current={r.assigned_to}
                  label={`Offene Zahlung – ${r.participant_name ?? "Teilnehmer"}`}
                  onDone={(a) =>
                    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, assigned_to: a } : x)))
                  }
                />
                <div className="font-semibold whitespace-nowrap">
                  {r.price_amount != null
                    ? `${Number(r.price_amount).toFixed(2).replace(".", ",")} €`
                    : "–"}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 md:w-80">
                  <Input
                    placeholder="Notiz (optional, z. B. Überweisung)"
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  />
                  <Button onClick={() => markPaid(r)} disabled={busy === r.id}>
                    <Check className="h-4 w-4 mr-1" /> Bezahlt
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
