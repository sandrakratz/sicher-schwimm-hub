import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateBerlin, formatDateTimeBerlin } from "@/lib/format";
import {
  EVENT_STATUS_LABEL,
  FAMILY_SWIM,
  REQUEST_STATUS_LABEL,
  priorityScore,
  weekdayDate,
  type EventStatus,
  type RequestStatus,
} from "@/lib/familienschwimmen";
import {
  applyFamilySwimAllocation,
  cancelFamilySwimEvent,
  getFamilySwimAdmin,
  promoteFamilySwimWaitlist,
  proposeFamilySwim,
  saveFamilySwimEvent,
  setFamilySwimRequest,
  type AdminEvent,
  type AdminFamily,
  type AdminRequest,
  type ProposalView,
} from "@/lib/familienschwimmen.functions";

export const Route = createFileRoute("/_authenticated/admin/familienschwimmen")({
  ssr: false,
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
      { title: "Familienschwimmen – Adminbereich | Sicher Schwimmen e.V." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const selectClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";
type Tab = "termine" | "anmeldungen" | "vergabe" | "familien";

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "confirmed" || s === "attended") return "default";
  if (s === "waitlist" || s === "requested") return "secondary";
  if (s === "no_show" || s === "declined") return "destructive";
  return "outline";
}

function Page() {
  const [tab, setTab] = useState<Tab>("termine");
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [families, setFamilies] = useState<AdminFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventId, setEventId] = useState("");

  async function load() {
    try {
      const r = await getFamilySwimAdmin();
      setEvents(r.events);
      setRequests(r.requests);
      setFamilies(r.families);
      setEventId(
        (cur) =>
          cur ||
          r.events.find((e) => e.event_date >= new Date().toISOString().slice(0, 10))?.id ||
          r.events[0]?.id ||
          "",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Daten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  if (loading)
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Wird geladen…
      </div>
    );

  const tabs: Array<[Tab, string]> = [
    ["termine", "Termine"],
    ["anmeldungen", "Anmeldungen"],
    ["vergabe", "Vergabe"],
    ["familien", "Familien"],
  ];

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-wrap gap-2">
        {tabs.map(([k, label]) => (
          <Button
            key={k}
            variant={tab === k ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(k)}
          >
            {label}
          </Button>
        ))}
      </div>
      {tab === "termine" && (
        <Termine
          events={events}
          reload={load}
          onOpen={(id) => {
            setEventId(id);
            setTab("anmeldungen");
          }}
        />
      )}
      {tab === "anmeldungen" && (
        <Anmeldungen
          events={events}
          requests={requests}
          eventId={eventId}
          setEventId={setEventId}
          reload={load}
        />
      )}
      {tab === "vergabe" && <Vergabe events={events} reload={load} />}
      {tab === "familien" && <Familien families={families} />}
    </div>
  );
}

function Termine({
  events,
  reload,
  onOpen,
}: {
  events: AdminEvent[];
  reload: () => Promise<void>;
  onOpen: (id: string) => void;
}) {
  const [edit, setEdit] = useState<null | {
    id?: string;
    event_date: string;
    capacity: number;
    deadline: string;
    status: "open" | "inactive";
    notes: string;
  }>(null);

  function startNew() {
    setEdit({ event_date: "", capacity: 10, deadline: "", status: "open", notes: "" });
  }
  function startEdit(e: AdminEvent) {
    setEdit({
      id: e.id,
      event_date: e.event_date,
      capacity: e.capacity,
      deadline: toLocalInput(e.registration_deadline),
      status: e.status === "inactive" ? "inactive" : "open",
      notes: e.notes ?? "",
    });
  }
  async function save() {
    if (!edit) return;
    let deadline = edit.deadline;
    if (!deadline && edit.event_date) {
      const d = new Date(`${edit.event_date}T23:59`);
      d.setDate(d.getDate() - FAMILY_SWIM.deadlineDaysBefore);
      deadline = toLocalInput(d.toISOString());
    }
    try {
      await saveFamilySwimEvent({
        data: {
          id: edit.id,
          event_date: edit.event_date,
          capacity: edit.capacity,
          registration_deadline: deadline,
          status: edit.status,
          notes: edit.notes,
        },
      });
      toast.success("Termin gespeichert.");
      setEdit(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }
  async function cancelEvent(e: AdminEvent) {
    if (
      !confirm(
        `${weekdayDate(e.event_date)} absagen? Alle angemeldeten Familien bekommen eine E-Mail, der Termin kann nicht wieder geöffnet werden.`,
      )
    )
      return;
    try {
      const r = await cancelFamilySwimEvent({ data: { id: e.id } });
      toast.success(`Abgesagt, ${r.notified} Familien informiert.`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Absage fehlgeschlagen.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-primary-deep">Termine</h2>
        <Button size="sm" onClick={startNew}>
          Neuer Termin
        </Button>
      </div>

      {edit && (
        <Card>
          <CardContent className="p-4 grid gap-3 sm:grid-cols-4 items-end">
            <label className="text-sm">
              Datum
              <Input
                type="date"
                value={edit.event_date}
                onChange={(e) => setEdit({ ...edit, event_date: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Kapazität ({FAMILY_SWIM.capacityMin}–{FAMILY_SWIM.capacityMax} Personen)
              <select
                className={`${selectClass} w-full`}
                value={edit.capacity}
                onChange={(e) => setEdit({ ...edit, capacity: Number(e.target.value) })}
              >
                {[8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Anmeldeschluss (leer = 7 Tage vorher)
              <Input
                type="datetime-local"
                value={edit.deadline}
                onChange={(e) => setEdit({ ...edit, deadline: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Status
              <select
                className={`${selectClass} w-full`}
                value={edit.status}
                onChange={(e) =>
                  setEdit({ ...edit, status: e.target.value as "open" | "inactive" })
                }
              >
                <option value="open">Offen</option>
                <option value="inactive">Deaktiviert (nicht sichtbar)</option>
              </select>
            </label>
            <div className="sm:col-span-4 flex gap-2">
              <Button size="sm" onClick={save} disabled={!edit.event_date}>
                Speichern
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEdit(null)}>
                Abbrechen
              </Button>
              <span className="text-xs text-muted-foreground self-center">
                Eine niedrigere Kapazität löscht keine bestätigten Teilnehmer.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Termin</TableHead>
            <TableHead>Bestätigt</TableHead>
            <TableHead>Frei</TableHead>
            <TableHead>Familien</TableHead>
            <TableHead>Warteliste</TableHead>
            <TableHead>Anmeldeschluss</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-medium">{weekdayDate(e.event_date)}</TableCell>
              <TableCell>
                {e.confirmedSeats} / {e.capacity} Personen
              </TableCell>
              <TableCell>{Math.max(0, e.capacity - e.confirmedSeats)}</TableCell>
              <TableCell>
                {e.confirmedFamilies + e.requestedFamilies + e.waitlistFamilies} (
                {e.requestedFamilies} offen)
              </TableCell>
              <TableCell>{e.waitlistFamilies}</TableCell>
              <TableCell className="text-sm">
                {formatDateTimeBerlin(e.registration_deadline)}
              </TableCell>
              <TableCell>
                <Badge variant={e.status === "open" ? "default" : "outline"}>
                  {EVENT_STATUS_LABEL[e.status as EventStatus]}
                </Badge>
                {e.allocated_at && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    vergeben {formatDateBerlin(e.allocated_at)}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right space-x-1 whitespace-nowrap">
                <Button size="sm" variant="outline" onClick={() => onOpen(e.id)}>
                  Anmeldungen
                </Button>
                {e.status !== "cancelled" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => startEdit(e)}>
                      Bearbeiten
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => cancelEvent(e)}>
                      Absagen
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Anmeldungen({
  events,
  requests,
  eventId,
  setEventId,
  reload,
}: {
  events: AdminEvent[];
  requests: AdminRequest[];
  eventId: string;
  setEventId: (id: string) => void;
  reload: () => Promise<void>;
}) {
  const event = events.find((e) => e.id === eventId);
  const rows = useMemo(
    () =>
      requests
        .filter((r) => r.event_id === eventId)
        .sort(
          (a, b) =>
            priorityScore(a.standing) - priorityScore(b.standing) ||
            a.requested_at.localeCompare(b.requested_at),
        ),
    [requests, eventId],
  );

  async function act(
    r: AdminRequest,
    action:
      | "confirm"
      | "waitlist"
      | "decline"
      | "cancel"
      | "attended"
      | "no_show"
      | "reopen"
      | "waive_strike"
      | "restore_strike",
    ask?: string,
  ) {
    if (ask && !confirm(ask)) return;
    try {
      const res = await setFamilySwimRequest({ data: { requestId: r.id, action } });
      toast.success(res.message);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Aktion fehlgeschlagen.");
    }
  }

  async function promote() {
    try {
      const r = await promoteFamilySwimWaitlist({ data: { eventId } });
      toast.success(
        r.promoted ? `${r.promoted} Familie(n) nachgerückt.` : "Niemand kann nachrücken.",
      );
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nachrücken fehlgeschlagen.");
    }
  }

  const past = event ? event.event_date <= new Date().toISOString().slice(0, 10) : false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          className={selectClass}
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {weekdayDate(e.event_date)} ({EVENT_STATUS_LABEL[e.status as EventStatus]})
            </option>
          ))}
        </select>
        {event && (
          <span className="text-sm text-muted-foreground">
            {event.confirmedSeats} / {event.capacity} Personen bestätigt ·{" "}
            {Math.max(0, event.capacity - event.confirmedSeats)} frei
          </span>
        )}
        <Button size="sm" variant="outline" onClick={promote}>
          Nachrücken auslösen
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Anmeldungen für diesen Termin.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Familie</TableHead>
              <TableHead>Personen</TableHead>
              <TableHead title="Teilnahmen + Strafpunkte">Priorität</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.contact_name ?? "(Daten gelöscht)"}</div>
                  <div className="text-xs text-muted-foreground">{r.contact_email}</div>
                  <div className="text-xs text-muted-foreground">
                    angemeldet {formatDateTimeBerlin(r.requested_at)}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <div>
                    {r.seats} {r.seats === 1 ? "Person" : "Personen"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.persons.map((p) => p.name).join(", ")}
                  </div>
                  {r.grandstand_name && (
                    <div className="text-xs">Tribüne: {r.grandstand_name} · Bronze bestätigt</div>
                  )}
                  {r.note && <div className="text-xs italic">„{r.note}“</div>}
                </TableCell>
                <TableCell className="text-sm">
                  <div className="font-medium">{priorityScore(r.standing)}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.standing.participations} Teilnahmen · {r.standing.strikes} Strafpunkte
                  </div>
                  {r.strike && (
                    <div className="text-xs">
                      {r.strike_waived ? "Strafpunkt erlassen" : "Strafpunkt aus diesem Termin"}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(r.status)}>
                    {REQUEST_STATUS_LABEL[r.status as RequestStatus] ?? r.status}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-1 space-y-1">
                  {["requested", "waitlist", "declined"].includes(r.status) && (
                    <Button size="sm" onClick={() => act(r, "confirm")}>
                      Zusagen
                    </Button>
                  )}
                  {["requested", "confirmed"].includes(r.status) && (
                    <Button size="sm" variant="outline" onClick={() => act(r, "waitlist")}>
                      Auf Warteliste
                    </Button>
                  )}
                  {["requested", "waitlist", "confirmed"].includes(r.status) && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => act(r, "decline", "Anmeldung ablehnen?")}
                      >
                        Ablehnen
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => act(r, "cancel", "Anmeldung stornieren?")}
                      >
                        Stornieren
                      </Button>
                    </>
                  )}
                  {r.status === "confirmed" && past && (
                    <>
                      <Button size="sm" onClick={() => act(r, "attended")}>
                        Teilgenommen
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => act(r, "no_show")}>
                        Nicht erschienen
                      </Button>
                    </>
                  )}
                  {(r.status === "attended" || r.status === "no_show") && (
                    <Button size="sm" variant="outline" onClick={() => act(r, "reopen")}>
                      Zurücksetzen
                    </Button>
                  )}
                  {r.strike && !r.strike_waived && (
                    <Button size="sm" variant="outline" onClick={() => act(r, "waive_strike")}>
                      Strafpunkt erlassen
                    </Button>
                  )}
                  {r.strike && r.strike_waived && (
                    <Button size="sm" variant="outline" onClick={() => act(r, "restore_strike")}>
                      Strafpunkt zurück
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function Vergabe({ events, reload }: { events: AdminEvent[]; reload: () => Promise<void> }) {
  const now = Date.now();
  const candidates = events.filter(
    (e) => e.status === "open" && e.requestedFamilies + e.waitlistFamilies > 0,
  );
  const [picked, setPicked] = useState<string[]>(() =>
    candidates
      .filter((e) => new Date(e.registration_deadline).getTime() < now && !e.allocated_at)
      .map((e) => e.id),
  );
  const [proposal, setProposal] = useState<ProposalView | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) => {
    setProposal(null);
    setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  };

  async function compute() {
    setBusy(true);
    try {
      setProposal(await proposeFamilySwim({ data: { eventIds: picked } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Vorschlag fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (
      !confirm(
        "Vergabe jetzt übernehmen? Alle betroffenen Familien bekommen eine E-Mail (Zusage oder Warteliste).",
      )
    )
      return;
    setBusy(true);
    try {
      const r = await applyFamilySwimAllocation({ data: { eventIds: picked } });
      toast.success(
        `${r.confirmed} Zusagen, ${r.waitlist} Warteliste, ${r.mails} Mails verschickt.`,
      );
      setProposal(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Vergabe fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-primary-deep">Faire Vergabe</h2>
      <p className="text-sm text-muted-foreground max-w-3xl">
        Erst ein Vorschlag, dann übernehmen. In jeder Runde bekommt jede Familie höchstens einen
        weiteren Termin. Reihenfolge: Teilnahmen plus Strafpunkte (weniger zuerst), dann weniger
        bereits zugesagte Termine, dann längere Zeit seit der letzten Teilnahme, dann der Zeitpunkt
        der Anmeldung. Familien werden nie teilweise angenommen.
      </p>
      {candidates.length === 0 ? (
        <p className="text-sm">Aktuell gibt es keine offenen Anfragen.</p>
      ) : (
        <div className="space-y-2">
          {candidates.map((e) => (
            <label key={e.id} className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={picked.includes(e.id)} onCheckedChange={() => toggle(e.id)} />
              <span className="text-sm">
                {weekdayDate(e.event_date)} · {e.requestedFamilies} offene, {e.waitlistFamilies} auf
                der Warteliste · Anmeldeschluss {formatDateTimeBerlin(e.registration_deadline)}
                {new Date(e.registration_deadline).getTime() > now && (
                  <span className="text-amber-700"> (noch nicht abgelaufen)</span>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || picked.length === 0} onClick={compute}>
          Vorschlag berechnen
        </Button>
        {proposal && (
          <Button size="sm" disabled={busy} onClick={apply}>
            Vergabe übernehmen
          </Button>
        )}
      </div>

      {proposal && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Termin</TableHead>
              <TableHead>Familie</TableHead>
              <TableHead>Personen</TableHead>
              <TableHead>Teilnahmen / Strafpunkte</TableHead>
              <TableHead>Ergebnis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proposal.rows.map((r) => (
              <TableRow key={r.requestId}>
                <TableCell>{weekdayDate(r.eventDate)}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.seats}</TableCell>
                <TableCell>
                  {r.participations} / {r.strikes}
                  {r.pendingConfirmed > 0 && ` · ${r.pendingConfirmed} Termin(e) schon zugesagt`}
                </TableCell>
                <TableCell>
                  {r.outcome === "confirmed" ? (
                    <Badge>Zusage (Runde {r.round})</Badge>
                  ) : (
                    <Badge variant="secondary">Warteliste</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function Familien({ families }: { families: AdminFamily[] }) {
  const [q, setQ] = useState("");
  const rows = families.filter((f) =>
    `${f.name ?? ""} ${f.email ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-primary-deep">Familien</h2>
        <Input
          placeholder="Suchen (Name, E-Mail)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Konto</TableHead>
            <TableHead>Teilnahmen</TableHead>
            <TableHead>Strafpunkte</TableHead>
            <TableHead>Letzte Teilnahme</TableHead>
            <TableHead>Offene Anmeldungen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((f) => (
            <TableRow key={f.user_id}>
              <TableCell>
                <div className="font-medium">{f.name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{f.email}</div>
              </TableCell>
              <TableCell>{f.participations}</TableCell>
              <TableCell>{f.strikes}</TableCell>
              <TableCell>
                {f.last_participation ? formatDateBerlin(f.last_participation) : "—"}
              </TableCell>
              <TableCell>{f.open}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
