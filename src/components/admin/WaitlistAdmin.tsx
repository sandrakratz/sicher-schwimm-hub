import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WaitlistToday } from "@/components/admin/WaitlistToday";
import { WaitlistReport } from "@/components/admin/WaitlistReport";
import { categorizeReason } from "@/lib/decline-reasons";
import { relatedProgramIds } from "@/lib/waitlist-programs";
import { listWaitlist } from "@/lib/waitlist.functions";
import {
  WAITING_KIND_LABEL,
  buildTodo,
  inView,
  waitingKindOf,
  type AdminView,
  type TodayOnly,
  type WaitingKind,
  type WaitlistEntry,
} from "@/components/admin/warteliste/logic";
import {
  WAITLIST_QUERY_KEY,
  useWaitlistMutations,
} from "@/components/admin/warteliste/useWaitlistMutations";
import { AllocateButton } from "@/components/admin/warteliste/ui";
import { GuideDialog } from "@/components/admin/warteliste/GuideDialog";
import { CancellationsCard } from "@/components/admin/warteliste/CancellationsCard";
import { ProgramTiles } from "@/components/admin/warteliste/ProgramTiles";
import { EntryRow } from "@/components/admin/warteliste/EntryRow";
import { OriginalRequestDialog } from "@/components/admin/warteliste/OriginalRequestDialog";
import { DeclineOfferDialog } from "@/components/admin/warteliste/DeclineOfferDialog";

const TABS: Array<[AdminView, string]> = [
  ["today", "Übersicht"],
  ["waiting", "Wartend"],
  ["offered", "Angebote"],
  ["followup", "Rückfragen"],
  ["declined", "Absagen"],
  ["done", "Archiv"],
  ["report", "Nachfrage"],
];

const ENTRY_HEAD = ["Kind", "Eltern", "Status", "Zuständig", "Aktion"];

export function WaitlistAdmin({
  initialMine,
  initialProgramIds,
  initialSearch,
}: { initialProgramIds?: string[]; initialSearch?: string; initialMine?: boolean } = {}) {
  const [view, setView] = useState<AdminView>(initialProgramIds?.length ? "waiting" : "today");
  const [todayOnly, setTodayOnly] = useState<TodayOnly | null>(null);
  const [waitingKind, setWaitingKind] = useState<WaitingKind | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [search, setSearch] = useState(initialSearch ?? "");
  const [programFilter, setProgramFilter] = useState<string[] | null>(
    initialProgramIds?.length ? initialProgramIds : null,
  );
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const toggleRow = (id: string) =>
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const [detail, setDetail] = useState<WaitlistEntry | null>(null);
  const [declineFor, setDeclineFor] = useState<WaitlistEntry | null>(null);

  const {
    data,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: WAITLIST_QUERY_KEY,
    queryFn: () => listWaitlist(),
    // Neue Eingänge sollen ohne manuelles Neuladen auftauchen
    refetchInterval: 120_000,
  });

  const m = useWaitlistMutations();

  // Alte Kursanfragen mit Status „Warteliste“ einmalig übernehmen (idempotent)
  const migratedOnce = useRef(false);
  const migrate = m.migrate.mutate;
  useEffect(() => {
    if (migratedOnce.current) return;
    migratedOnce.current = true;
    migrate();
  }, [migrate]);

  const programs = data?.programs ?? [];
  const courses = data?.courses ?? [];
  const allEntries = data?.entries ?? [];
  const cancellations = data?.cancellations ?? [];
  const courseName = (id: unknown) => courses.find((c) => c.id === id)?.name ?? "Kurs";

  const countOf = (v: AdminView) => allEntries.filter((e) => inView(e, v)).length;
  const tabCounts = {
    waiting: countOf("waiting"),
    offered: countOf("offered"),
    followup: countOf("followup"),
    declined: countOf("declined") + cancellations.length,
    done: countOf("done"),
  };
  const q = search.trim().toLowerCase();
  const shown = q ? "search" : view;
  const isList = shown !== "today" && shown !== "search" && shown !== "report";
  const matchesSearch = (...vals: Array<unknown>) =>
    vals.some((v) =>
      String(v ?? "")
        .toLowerCase()
        .includes(q),
    );
  const cancellationsShown = q
    ? cancellations.filter((c) => matchesSearch(c.child_name, c.parent_email))
    : cancellations;
  const showCancellations =
    (shown === "declined" || shown === "search") && cancellationsShown.length > 0;

  const reasonCounts = (() => {
    const counts = new Map<string, number>();
    const reasons = [
      ...allEntries.filter((e) => e.decline_count > 0).map((e) => e.last_decline_reason),
      ...cancellations.map((c) => c.reason),
    ];
    for (const r of reasons) {
      const c = categorizeReason(r ?? null);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  })();

  const listed = q
    ? allEntries.filter((e) =>
        matchesSearch(e.child_name, e.parent_name, e.parent_email, e.parent_phone),
      )
    : view === "today" || view === "report"
      ? []
      : allEntries.filter(
          (e) =>
            inView(e, view) &&
            (!programFilter || programFilter.includes(e.program_id ?? "none")) &&
            (view !== "waiting" || !waitingKind || waitingKindOf(e, data) === waitingKind),
        );
  const grouped = new Map<string, WaitlistEntry[]>();
  for (const e of listed) {
    const key = e.program_id ?? "none";
    grouped.set(key, [...(grouped.get(key) ?? []), e]);
  }

  // Freie Plätze der Kurse, die zu einem Programm gehören (für den Gruppenkopf der Wartenden)
  const freeForProgram = (programId: string) =>
    courses
      .filter(
        (c) => c.free != null && relatedProgramIds(c.program_id, programs).includes(programId),
      )
      .reduce((sum, c) => sum + (c.free ?? 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Anfrageliste wird geladen…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <p className="font-semibold">Die Anfrageliste konnte nicht geladen werden.</p>
        <p className="text-muted-foreground">
          Das ist ein technischer Fehler, die Einträge sind nicht gelöscht. Meldung:{" "}
          {loadError.message}
        </p>
      </div>
    );
  }

  const filterNote = (text: string, onClear: () => void) => (
    <p className="text-sm text-muted-foreground">
      {text}{" "}
      <button type="button" className="underline" onClick={onClear}>
        Filter aufheben
      </button>
    </p>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-primary-deep">Anfrageliste</h2>
          <p className="text-sm text-muted-foreground">
            Automatische Platzvergabe: Mitglieder zuerst, danach nach Eingangsdatum. Angeboten wird
            nur, wenn das Kind zum Kursbeginn das Mindestalter erreicht. Angebote laufen nach der im
            Programm hinterlegten Frist ab.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AllocateButton onClick={() => m.allocate.mutate()} pending={m.allocate.isPending} />
        </div>
      </div>

      <GuideDialog open={guideOpen} onOpenChange={setGuideOpen} />

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(ev) => setSearch(ev.target.value)}
          placeholder="Suchen: Kind, Eltern, E-Mail, Telefon …"
          className="max-w-sm"
        />
        {q && (
          <Button size="sm" variant="ghost" onClick={() => setSearch("")}>
            Suche löschen
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {TABS.map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={shown === key ? "default" : "outline"}
            onClick={() => {
              setSearch("");
              setView(key);
              setTodayOnly(null);
              setWaitingKind(null);
            }}
          >
            {label}
            {key === "report"
              ? ""
              : ` (${key === "today" ? buildTodo(data).count : tabCounts[key]})`}
          </Button>
        ))}
      </div>

      {isList && (
        <ProgramTiles
          programs={programs}
          entries={allEntries}
          freeForProgram={freeForProgram}
          filter={programFilter}
          onFilter={setProgramFilter}
        />
      )}
      {programFilter &&
        isList &&
        filterNote(
          `Gefiltert auf ${programFilter.length === 1 ? "ein Angebot" : "mehrere Angebote (Mischkurs)"}.`,
          () => setProgramFilter(null),
        )}
      {waitingKind &&
        shown === "waiting" &&
        filterNote(`Gefiltert auf: ${WAITING_KIND_LABEL[waitingKind]}.`, () =>
          setWaitingKind(null),
        )}

      {q && (
        <p className="text-sm text-muted-foreground">
          Suchergebnis für „{search.trim()}“ in allen Reitern: {listed.length} Eintrag/Einträge,{" "}
          {cancellationsShown.length} Stornierung(en). Der Status steht jeweils in der Zeile.
        </p>
      )}

      {shown === "report" && <WaitlistReport data={data} />}

      {shown === "today" && (
        <WaitlistToday
          data={data}
          m={m}
          courseName={courseName}
          only={todayOnly}
          onOnly={setTodayOnly}
          counts={tabCounts}
          onGuide={() => setGuideOpen(true)}
          onWaitingKind={(k) => {
            setWaitingKind(k);
            setView("waiting");
          }}
          onGoto={(v) => {
            setWaitingKind(null);
            setView(v);
          }}
          onOpenDetail={setDetail}
          onDeclineOffer={setDeclineFor}
          initialMine={initialMine}
        />
      )}

      {shown === "followup" && (
        <p className="text-sm text-muted-foreground">
          Die Familien haben „Warteliste behalten?“ erhalten. Ohne Antwort innerhalb der Frist wird
          der Platz automatisch gestrichen.
        </p>
      )}
      {shown === "declined" && (
        <p className="text-sm text-muted-foreground">
          Alle Einträge mit mindestens einer Absage, egal in welchem Status (Zähler, Grund und
          Verlauf stehen in den Notizen). Der Zähler zählt je E-Mail bzw. Kind über alle Einträge.
        </p>
      )}

      {shown === "declined" && reasonCounts.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">Gründe der Absagen</h3>
          <div className="flex flex-wrap gap-2 text-sm">
            {reasonCounts.map(([reason, n]) => (
              <Badge key={reason} variant="secondary">
                {reason} · {n}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Zählt den zuletzt genannten Grund je Eintrag und die Gründe der Stornierungen. Ältere
            Freitexte werden automatisch einer Kategorie zugeordnet.
          </p>
        </div>
      )}

      {shown === "waiting" && courses.some((c) => c.max_participants != null) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {courses
            .filter((c) => c.max_participants != null)
            .map((c) => (
              <span key={c.id} className="rounded-md border bg-muted/40 px-2 py-1">
                <strong>{c.name}</strong>: {c.confirmed} gebucht · {c.held} angeboten · {c.free}{" "}
                frei
              </span>
            ))}
        </div>
      )}

      {showCancellations && (
        <CancellationsCard
          cancellations={cancellationsShown}
          onBlock={(c) =>
            m.blockSuggested(
              { childName: c.child_name, email: c.parent_email, total: c.declines_total },
              "Warteliste",
            )
          }
          onDismiss={(c) => m.dismissSuggested({ childName: c.child_name, email: c.parent_email })}
        />
      )}

      {grouped.size === 0 && !showCancellations && shown !== "today" && shown !== "report" && (
        <p className="text-muted-foreground">Keine Einträge in diesem Bereich.</p>
      )}

      {[...grouped].map(([programId, entries]) => (
        <CollapsibleCard
          key={programId}
          storageKey={`waitlist-${programId}`}
          title={programs.find((p) => p.id === programId)?.name ?? "Ohne Zuordnung"}
          meta={
            <span className="text-sm text-muted-foreground">
              {entries.length}{" "}
              {shown === "waiting"
                ? "wartend"
                : shown === "offered"
                  ? "Angebote aktiv"
                  : "Einträge"}
              {shown === "waiting" && programId !== "none" && freeForProgram(programId) > 0
                ? ` · ${freeForProgram(programId)} Platz/Plätze frei`
                : ""}
            </span>
          }
          contentClassName="overflow-x-auto"
        >
          <Table className="w-full min-w-[820px] text-sm">
            <TableHeader>
              <TableRow className="border-b text-left text-muted-foreground">
                {ENTRY_HEAD.map((h) => (
                  <TableHead key={h} className="py-2 pr-3 h-auto pl-0">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <EntryRow
                  key={e.id}
                  e={e}
                  data={data}
                  courseName={courseName}
                  open={openRows.has(e.id)}
                  onToggle={() => toggleRow(e.id)}
                  onDetail={() => setDetail(e)}
                  onDecline={() => setDeclineFor(e)}
                  m={m}
                />
              ))}
            </TableBody>
          </Table>
        </CollapsibleCard>
      ))}

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
