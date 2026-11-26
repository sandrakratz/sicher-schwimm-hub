import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  ChevronDown,
  FileArchive,
  FileDown,
  FileSpreadsheet,
  FileText,
  Mail,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Receipt,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CourseLifecycleActions } from "@/components/admin/CourseLifecycleActions";
import { relatedProgramIds } from "@/lib/waitlist-programs";
import {
  fmtDate,
  STATUS_LABEL,
  type Course,
  type CourseCounts,
  type ProgramRow,
} from "@/components/admin/kurse/shared";
import { EMPTY_COUNTS, hasStarted } from "@/components/admin/kurse/useCourseData";
import type { useCourseExports } from "@/components/admin/kurse/useCourseExports";

/** Alles, was eine Zeitraum-Karte zum Anzeigen und für ihre Knöpfe braucht. */
export type TermContext = {
  programs: ProgramRow[];
  counts: Record<string, CourseCounts>;
  waitingFor: (programId: string | null) => number;
  exports: ReturnType<typeof useCourseExports>;
  onParticipants: (c: Course) => void;
  onSessions: (c: Course) => void;
  onEdit: (c: Course) => void;
  onBroadcast: (c: Course) => void;
  onSessionsMail: (c: Course) => void;
  onArchive: (c: Course, archived: boolean) => void;
  onRemove: (c: Course) => void;
  onReload: () => Promise<void>;
};

function DownloadItems({ c, exports: x }: { c: Course; exports: TermContext["exports"] }) {
  const started = hasStarted(c);
  const items = [
    {
      Icon: FileSpreadsheet,
      busy: x.exporting === c.id,
      label: "Teilnehmerliste (Excel)",
      run: () => x.exportCourseList(c.id),
    },
    {
      Icon: Receipt,
      busy: x.exportingTax === c.id,
      blocked: !started,
      label: started ? "Steuerliste" : "Steuerliste (ab Kursbeginn)",
      run: () => x.exportTaxList(c.id),
    },
    {
      Icon: FileText,
      busy: x.exportingConf === `${c.id}-pdf`,
      label: "Kursbestätigungen (PDF)",
      run: () => x.exportConfirmations(c.id, "pdf"),
    },
    {
      Icon: FileArchive,
      busy: x.exportingConf === `${c.id}-zip`,
      label: "Kursbestätigungen einzeln (ZIP)",
      run: () => x.exportConfirmations(c.id, "zip"),
    },
    {
      Icon: FileText,
      busy: x.exportingProtocol === c.id,
      label: "Prüfungsprotokoll (DPO)",
      run: () => x.exportProtocol(c.id),
    },
    {
      Icon: FileDown,
      busy: x.exportingCsv === c.id,
      label: "MeinVerein (CSV)",
      run: () => x.exportMeinVerein(c.id),
    },
  ];
  return (
    <>
      {items.map(({ Icon, busy, blocked, label, run }) => (
        <DropdownMenuItem key={label} disabled={busy || blocked} onSelect={() => void run()}>
          <Icon /> {busy ? "Erstelle…" : label}
        </DropdownMenuItem>
      ))}
    </>
  );
}

/** Karte eines Kurszeitraums: Belegung, Zahlungen, Dienstplan und Aktionen. */
export function TermCard({ c, ctx }: { c: Course; ctx: TermContext }) {
  const cnt = ctx.counts[c.id] || EMPTY_COUNTS;
  const max = c.max_participants;
  const full = max != null && cnt.confirmed >= max;
  const pct = max ? Math.min(100, Math.round((cnt.confirmed / max) * 100)) : 0;
  const free = max != null ? max - cnt.confirmed - (cnt.offered ?? 0) : 0;
  const waiting = ctx.waitingFor(c.program_id);
  const payLabel =
    cnt.confirmed === 0
      ? "Keine Buchungen"
      : cnt.overdue > 0
        ? `${cnt.overdue} überfällig · ${cnt.unpaid} offen`
        : cnt.unpaid > 0
          ? `${cnt.unpaid} offen`
          : "Alle bezahlt";
  const payVariant = cnt.overdue > 0 ? "destructive" : cnt.unpaid > 0 ? "secondary" : "outline";
  const openSess = cnt.sessions - cnt.staffed;
  const rosterLabel =
    cnt.sessions === 0
      ? "Keine Termine"
      : openSess === 0
        ? `Vollständig besetzt (${cnt.staffed}/${cnt.sessions})`
        : `${openSess} ${openSess === 1 ? "Termin" : "Termine"} nicht voll besetzt (${c.trainers_needed ?? 2} Trainer:innen nötig)`;
  const rosterVariant = cnt.sessions > 0 && openSess > 0 ? "destructive" : "outline";

  return (
    <div className={`rounded-lg border bg-card p-4 space-y-3 ${c.archived_at ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold">
            {fmtDate(c.starts_on) || "—"} – {fmtDate(c.ends_on) || "—"}
          </div>
          <div className="text-xs text-muted-foreground">
            {c.name} · {c.schedule || "Zeitplan offen"}
            {!c.is_public && " · intern"}
            {c.archived_at && " · archiviert"}
          </div>
        </div>
        <Badge variant="secondary">{STATUS_LABEL[c.status] || c.status}</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 text-xs">
        <div>
          <div className="text-muted-foreground mb-1">Belegung</div>
          <div className={full ? "text-destructive font-semibold" : "font-semibold"}>
            {cnt.confirmed}
            {max != null ? ` / ${max}` : ""} belegt
            {cnt.waiting > 0 && (
              <span className="font-normal text-muted-foreground">
                {" "}
                · +{cnt.waiting} Warteliste
              </span>
            )}
          </div>
          {max != null && (
            <div className="text-muted-foreground">
              {(cnt.offered ?? 0) > 0 && <>{cnt.offered} reserviert · </>}
              <span className={free > 0 ? "text-success font-semibold" : ""}>
                {Math.max(0, free)} frei
              </span>
            </div>
          )}
          {waiting > 0 && (
            <div className="mt-0.5">
              <a
                href={`/admin/warteliste?programm=${relatedProgramIds(c.program_id, ctx.programs).join(",")}`}
                className="text-primary underline underline-offset-2"
                title="Familien auf der Anfrageliste, die auf einen Platz in diesem Angebot warten"
              >
                {waiting} Familie(n) auf der Anfrageliste
              </a>
            </div>
          )}
          {max ? (
            <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full ${full ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          ) : null}
        </div>
        <div>
          <div className="text-muted-foreground mb-1">Zahlungen</div>
          <Badge variant={payVariant}>{payLabel}</Badge>
        </div>
        <div>
          <div className="text-muted-foreground mb-1">Dienstplan</div>
          <a href={`/admin/dienstplan?tab=einteilen&kurs=${c.id}`}>
            <Badge variant={rosterVariant}>{rosterLabel}</Badge>
          </a>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1 border-t pt-3">
        <Button variant="outline" size="sm" onClick={() => ctx.onParticipants(c)}>
          <Users className="h-4 w-4" /> Teilnehmer
        </Button>
        <Button variant="outline" size="sm" onClick={() => ctx.onSessions(c)}>
          <CalendarDays className="h-4 w-4" /> Termine
        </Button>
        <Button
          variant="outline"
          size="sm"
          asChild
          title="Trainerteam für alle Termine dieses Kurses einteilen"
        >
          <a href={`/admin/dienstplan?tab=einteilen&kurs=${c.id}`}>
            <Users className="h-4 w-4" /> Trainer einteilen
          </a>
        </Button>
        <Button variant="outline" size="sm" onClick={() => ctx.onEdit(c)}>
          <Pencil className="h-4 w-4" /> Bearbeiten
        </Button>
        {!c.archived_at && <CourseLifecycleActions course={c} onDone={ctx.onReload} />}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="ml-auto">
              <MoreHorizontal className="h-4 w-4" /> Aktionen & Downloads{" "}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Downloads</DropdownMenuLabel>
            <DownloadItems c={c} exports={ctx.exports} />
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Aktionen</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => ctx.onBroadcast(c)}>
              <Megaphone className="text-destructive" /> Eilnachricht an alle Eltern
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => ctx.onSessionsMail(c)}>
              <Mail /> Kurstermine per E-Mail nachsenden
            </DropdownMenuItem>
            {c.archived_at ? (
              <DropdownMenuItem onSelect={() => ctx.onArchive(c, false)}>
                <ArchiveRestore /> Wiederherstellen
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => ctx.onArchive(c, true)}>
                <Archive /> Archivieren
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex-col items-start gap-0.5 text-destructive focus:text-destructive"
              onSelect={() => ctx.onRemove(c)}
            >
              <span className="flex items-center gap-2">
                <Trash2 /> Kurszeitraum löschen …
              </span>
              <span className="text-xs text-muted-foreground">
                Nur ohne Buchungen, z. B. Fehleintrag – sonst „Archivieren“
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/** Zeiträume eines Angebots (oder ohne Angebot), archivierte auf Wunsch eingeblendet. */
export function TermList({ terms, ctx }: { terms: Course[]; ctx: TermContext }) {
  const [showArchived, setShowArchived] = useState(false);
  const active = terms.filter((t) => !t.archived_at);
  const archived = terms.filter((t) => !!t.archived_at);
  const visible = showArchived ? [...active, ...archived] : active;
  return (
    <div className="space-y-3">
      {visible.length === 0 ? (
        <div className="rounded-lg border py-6 text-center text-muted-foreground text-xs">
          Noch keine Kurszeiträume.
        </div>
      ) : (
        visible.map((c) => <TermCard key={c.id} c={c} ctx={ctx} />)
      )}
      {archived.length > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
          <Archive className="h-4 w-4" />{" "}
          {showArchived ? "Archivierte ausblenden" : `Archivierte anzeigen (${archived.length})`}
        </Button>
      )}
    </div>
  );
}
