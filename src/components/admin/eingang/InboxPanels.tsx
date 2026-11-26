import { askConfirm } from "@/components/admin/confirm-store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { effectiveAssignee, useAssignmentContext } from "@/components/admin/AssignControl";
import {
  PaymentCard,
  dueOf,
  isOverdue,
  useOpenPayments,
  type PaymentRow,
} from "@/components/admin/payments/OpenPayments";
import { MessageCard, isOpenMessage, useMessages } from "@/components/admin/messages/MessageCard";
import { GapList } from "@/components/admin/dienstplan/GapList";
import { ReplacementDialog } from "@/components/admin/dienstplan/ReplacementDialog";
import { WithdrawalDialog } from "@/components/admin/dienstplan/WithdrawalDialog";
import { loadPlanningData } from "@/lib/dienstplan.functions";
import type { PlanData } from "@/lib/dienstplan";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listWaitlist } from "@/lib/waitlist.functions";
import { WaitlistToday } from "@/components/admin/WaitlistToday";
import {
  WAITLIST_QUERY_KEY,
  useWaitlistMutations,
} from "@/components/admin/warteliste/useWaitlistMutations";
import type { TodayOnly, WaitlistEntry } from "@/components/admin/warteliste/logic";
import { OriginalRequestDialog } from "@/components/admin/warteliste/OriginalRequestDialog";
import { DeclineOfferDialog } from "@/components/admin/warteliste/DeclineOfferDialog";
import { toast } from "sonner";
import { getFamilySwimAdmin, type AdminEvent } from "@/lib/familienschwimmen.functions";
import { Vergabe } from "@/components/admin/familienschwimmen/Vergabe";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { setMembershipStatus } from "@/lib/membership.functions";
import { MEMBERSHIP_TYPE_LABEL } from "@/lib/labels";
import { formatDateBerlin } from "@/lib/format";
import { AgeBadge } from "@/components/admin/AgeBadge";
import { InboxItemCard } from "@/components/admin/InboxItemCard";
import { listInbox, type InboxItem } from "@/lib/inbox.functions";

/** Meldet Änderungen an der Anzahl nach oben, damit die Zähler links mitlaufen (nicht beim ersten Laden). */
function useReportCount(count: number | null, onChanged: () => void) {
  const first = useRef<number | null>(null);
  useEffect(() => {
    if (count === null) return;
    if (first.current === null) {
      first.current = count;
      return;
    }
    onChanged();
  }, [count, onChanged]);
}

function Done({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/10 p-4">
      <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
      <span className="text-sm font-medium">{text}</span>
    </div>
  );
}

const Loading = () => <p className="text-sm text-muted-foreground">Wird geladen …</p>;

/** Offene Zahlungen: überfällige oder die mir zugewiesenen, jede mit Bezahlt / Erinnern / Frist. */
export function PaymentsPanel({
  only,
  onChanged,
}: {
  only: "overdue" | "mine";
  onChanged: () => void;
}) {
  const pay = useOpenPayments();
  const ctx = useAssignmentContext();
  const me = ctx.data?.me;
  const shown = useMemo(
    () =>
      pay.rows
        .filter((r: PaymentRow) =>
          only === "overdue"
            ? isOverdue(r)
            : !!me && effectiveAssignee(r.assigned_to, "payments", ctx.data?.rules) === me,
        )
        .sort((a, b) => dueOf(a).getTime() - dueOf(b).getTime()),
    [pay.rows, only, me, ctx.data?.rules],
  );
  useReportCount(pay.loading ? null : shown.length, onChanged);
  if (pay.loading) return <Loading />;
  if (shown.length === 0) return <Done text="Keine offenen Zahlungen in dieser Auswahl." />;
  return (
    <div className="space-y-3">
      {shown.map((r) => (
        <PaymentCard key={r.id} r={r} pay={pay} />
      ))}
    </div>
  );
}

/** Unbeantwortete Nachrichten (alle oder die mir zugewiesenen). Beschwerden zuerst, dann die ältesten. */
export function MessagesPanel({
  only,
  onChanged,
}: {
  only: "open" | "mine";
  onChanged: () => void;
}) {
  const msgs = useMessages();
  const ctx = useAssignmentContext();
  const me = ctx.data?.me;
  const shown = useMemo(
    () =>
      msgs.rows
        .filter(isOpenMessage)
        .filter(
          (m) =>
            only === "open" ||
            (!!me && effectiveAssignee(m.assigned_to, "messages", ctx.data?.rules) === me),
        )
        .sort(
          (a, b) =>
            (a.category === "complaint" ? 0 : 1) - (b.category === "complaint" ? 0 : 1) ||
            a.created_at.localeCompare(b.created_at),
        ),
    [msgs.rows, only, me, ctx.data?.rules],
  );
  useReportCount(msgs.loading ? null : shown.length, onChanged);
  if (msgs.loading) return <Loading />;
  if (shown.length === 0) return <Done text="Alles beantwortet." />;
  return (
    <div className="space-y-3">
      {shown.map((m, i) => (
        <MessageCard key={m.id} m={m} msgs={msgs} showAge defaultOpen={i === 0} />
      ))}
    </div>
  );
}

/**
 * Ausschnitte der Anfrageliste: dieselben Listen und Knöpfe wie im Anfrageliste
 * (ablaufende Angebote, Wiedervorlagen, Sperrvorschläge), samt Detail- und Absage-Dialog.
 */
export function WaitlistPanel({
  sections,
  onChanged,
}: {
  sections: { only: TodayOnly; label: string }[];
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: WAITLIST_QUERY_KEY,
    queryFn: () => listWaitlist(),
  });
  const m = useWaitlistMutations();
  const [only, setOnly] = useState<TodayOnly>(sections[0]!.only);
  const [detail, setDetail] = useState<WaitlistEntry | null>(null);
  const [declineFor, setDeclineFor] = useState<WaitlistEntry | null>(null);
  useReportCount(isLoading ? null : dataUpdatedAt, onChanged);

  if (error)
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Anfrageliste konnte nicht geladen werden"}
      </p>
    );
  if (isLoading || !data) return <Loading />;
  const courseName = (id: unknown) => data.courses.find((c) => c.id === id)?.name ?? "Kurs";
  const toList = () => void navigate({ to: "/admin/warteliste" });

  return (
    <div className="space-y-3">
      {sections.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Bereich">
          {sections.map((s) => (
            <Button
              key={s.only}
              size="sm"
              variant={only === s.only ? "default" : "outline"}
              aria-pressed={only === s.only}
              onClick={() => setOnly(s.only)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      )}
      <WaitlistToday
        data={data}
        m={m}
        courseName={courseName}
        only={only}
        onGoto={toList}
        onOpenDetail={setDetail}
        onDeclineOffer={setDeclineFor}
      />
      <OriginalRequestDialog
        key={`detail-${detail?.id ?? ""}`}
        entry={detail}
        onClose={() => setDetail(null)}
        saving={m.update.isPending}
        onSave={(patch) =>
          m.update.mutate(patch, {
            onSuccess: () => {
              toast.success("Angaben gespeichert");
              setDetail(null);
            },
          })
        }
      />
      <DeclineOfferDialog
        key={`decline-${declineFor?.id ?? ""}`}
        entry={declineFor}
        onClose={() => setDeclineFor(null)}
        saving={m.recordDecline.isPending}
        onSave={(v) => m.recordDecline.mutate(v, { onSuccess: () => setDeclineFor(null) })}
      />
    </div>
  );
}

type PendingMembership = {
  id: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  membership_type: string;
  start_date: string | null;
  sepa_mandate_accepted: boolean | null;
  family_members: { partner?: { name?: string } | null; children?: unknown[] } | null;
};

/**
 * Offene Mitgliedsanträge mit Genehmigen / Ablehnen. Volle Angaben (SEPA, Familie bearbeiten,
 * Gültigkeit) bleiben im Antrag auf der Seite „Mitgliedschaften“, „Details“ öffnet ihn direkt.
 */
export function MembershipsPanel({ onChanged }: { onChanged: () => void }) {
  const setStatusFn = useServerFn(setMembershipStatus);
  const [rows, setRows] = useState<PendingMembership[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("memberships")
      .select(
        "id,created_at,first_name,last_name,email,membership_type,start_date,sepa_mandate_accepted,family_members",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) return void toast.error(error.message);
    setRows((data ?? []) as unknown as PendingMembership[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function decide(r: PendingMembership, status: "active" | "terminated") {
    const who = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim();
    if (
      status === "terminated" &&
      !(await askConfirm({
        title: "Antrag ablehnen?",
        consequence: (
          <>
            Der Mitgliedschaftsantrag von {who} wird abgelehnt und verschwindet aus dem Eingang. Es
            gilt weiter der Normalpreis. Wenn der Antrag doch stimmt, muss die Person ihn neu
            stellen.
          </>
        ),
        confirmLabel: "Antrag ablehnen",
        destructive: true,
      }))
    )
      return;
    setBusy(r.id);
    try {
      const res = await setStatusFn({ data: { id: r.id, status } });
      const repriced = (res as { repriced?: number } | undefined)?.repriced ?? 0;
      toast.success(
        status === "active"
          ? `${who} genehmigt${repriced > 0 ? ` – ${repriced} offene Kursbuchung(en) auf den Mitgliedspreis umgestellt` : ""}`
          : `Antrag von ${who} abgelehnt`,
      );
      await load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(null);
    }
  }

  if (!rows) return <Loading />;
  if (rows.length === 0) return <Done text="Keine offenen Mitgliedsanträge." />;
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const fm = r.family_members;
        const family = [
          fm?.partner?.name ? "Partner/in" : null,
          fm?.children?.length ? `${fm.children.length} Kind(er)` : null,
        ]
          .filter(Boolean)
          .join(", ");
        return (
          <Card key={r.id}>
            <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    {r.first_name} {r.last_name}
                  </span>
                  <Badge variant="outline">
                    {MEMBERSHIP_TYPE_LABEL[r.membership_type] ?? r.membership_type}
                  </Badge>
                  <AgeBadge since={r.created_at} />
                </div>
                <div className="text-sm text-muted-foreground">
                  Eingegangen {formatDateBerlin(r.created_at)}
                  {r.start_date && ` · Mitglied ab ${formatDateBerlin(r.start_date)}`}
                  {family && ` · ${family}`}
                  {` · SEPA-Mandat ${r.sepa_mandate_accepted ? "erteilt" : "fehlt"}`}
                </div>
                <div className="text-sm text-muted-foreground">{r.email}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="accent"
                  disabled={busy === r.id}
                  onClick={() => void decide(r, "active")}
                >
                  Genehmigen
                </Button>
                <Button
                  variant="outline"
                  disabled={busy === r.id}
                  onClick={() => void decide(r, "terminated")}
                >
                  Ablehnen
                </Button>
                <Button asChild variant="ghost">
                  <Link to="/admin/mitgliedschaften" search={{ antrag: r.id }}>
                    Details
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/** Neue Kursanfragen (altes Anfrageformular), dieselben Karten wie im Posteingang. */
export function CourseRequestsPanel({ onChanged }: { onChanged: () => void }) {
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    listInbox()
      .then((r) => setItems(r.items.filter((i) => i.source === "course-request")))
      .catch((e) => setError(e instanceof Error ? e.message : "Konnte nicht geladen werden"));
  }, []);
  useReportCount(items === null ? null : items.length, onChanged);
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!items) return <Loading />;
  if (items.length === 0) return <Done text="Keine neuen Kursanfragen." />;
  return (
    <div className="space-y-3">
      {items.map((i) => (
        <InboxItemCard key={`${i.source}-${i.id}`} item={i} showAge />
      ))}
    </div>
  );
}

/** Neue Vormerkungen fürs Mitgliederschwimmen: direkt die faire Vergabe. */
export function FamilySwimPanel({ onChanged }: { onChanged: () => void }) {
  const [events, setEvents] = useState<AdminEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setEvents((await getFamilySwimAdmin()).events);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Daten konnten nicht geladen werden.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!events) return <Loading />;
  return (
    <Vergabe
      events={events}
      reload={async () => {
        await load();
        onChanged();
      }}
    />
  );
}

/** Kurstermine, bei denen Trainer:innen fehlen – mit „Wer kann einspringen?“ und Absage erfassen. */
export function GapsPanel({ onChanged }: { onChanged: () => void }) {
  const load = useServerFn(loadPlanningData);
  const [data, setData] = useState<PlanData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickId, setPickId] = useState<string | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setData(await load({ data: {} }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dienstplan konnte nicht geladen werden");
    }
  }, [load]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const changed = useCallback(async () => {
    await refresh();
    onChanged();
  }, [refresh, onChanged]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <Loading />;
  const picked = data.sessions.find((s) => s.id === pickId) ?? null;
  return (
    <>
      <GapList data={data} onPick={setPickId} onWithdrawal={() => setWithdrawOpen(true)} />
      <ReplacementDialog
        session={picked}
        data={data}
        onClose={() => setPickId(null)}
        onChanged={() => void changed()}
      />
      <WithdrawalDialog
        open={withdrawOpen}
        data={data}
        onClose={() => setWithdrawOpen(false)}
        onDone={async (firstGap) => {
          setWithdrawOpen(false);
          await changed();
          if (firstGap) setPickId(firstGap);
        }}
      />
    </>
  );
}
