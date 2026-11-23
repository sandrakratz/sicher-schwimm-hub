// Kleine Bausteine der Anfrageliste: gemeinsam für „Heute“ und die Reiter, dazu Kacheln,
// Abschnitte und Listenzeilen der Ansicht „Heute“.
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssignControl } from "@/components/admin/AssignControl";
import type { WaitlistEntry } from "./logic";
import { WAITLIST_QUERY_KEY } from "./useWaitlistMutations";

/** Knopf „Plätze jetzt vergeben“ (automatische Platzvergabe). */
export function AllocateButton({ onClick, pending }: { onClick: () => void; pending: boolean }) {
  return (
    <Button size="sm" onClick={onClick} disabled={pending}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="mr-2 h-4 w-4" />
      )}
      Plätze jetzt vergeben
    </Button>
  );
}

/** „Zuständig: …“ für einen Eintrag der Anfrageliste. */
export function EntryAssign({ entry }: { entry: WaitlistEntry }) {
  const qc = useQueryClient();
  return (
    <AssignControl
      kind="waitlist"
      id={entry.id}
      area="waitlist"
      current={entry.assigned_to}
      label={`Anfrageliste – ${entry.child_name}`}
      onDone={() => qc.invalidateQueries({ queryKey: WAITLIST_QUERY_KEY })}
    />
  );
}

/** Die beiden Links eines Sperrvorschlags: „Sperren“ und „Ignorieren“. */
export function SuggestionActions({
  onBlock,
  onDismiss,
}: {
  onBlock: () => void;
  onDismiss: () => void;
}) {
  return (
    <>
      <button type="button" className="text-red-900 underline" onClick={onBlock}>
        Sperren
      </button>
      <button type="button" className="text-muted-foreground underline" onClick={onDismiss}>
        Ignorieren
      </button>
    </>
  );
}

export function Section({
  title,
  count,
  tone = "normal",
  onAll,
  children,
}: {
  title: string;
  count: number;
  tone?: "urgent" | "normal";
  onAll?: () => void;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border p-4 ${tone === "urgent" ? "border-red-300 bg-red-50" : "bg-card"}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-semibold">
          {title} <span className="text-muted-foreground">({count})</span>
        </h3>
        {onAll && (
          <Button size="sm" variant="ghost" onClick={onAll}>
            Alle anzeigen
          </Button>
        )}
      </div>
      <ul className="divide-y text-sm">{children}</ul>
    </section>
  );
}

/** Listenzeile eines Abschnitts: links Wer, rechts Was/Wann. */
export function Item({ children }: { children: ReactNode }) {
  return <li className="flex flex-wrap items-center justify-between gap-2 py-2">{children}</li>;
}

export function TileRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

export type Tone = "normal" | "warn" | "urgent";

/** Kachel der Übersicht: Zahl, Titel, ein erklärender Satz und die Aktion. */
export function Tile({
  n,
  label,
  hint,
  action = "Öffnen",
  onClick,
  tone = "normal",
}: {
  n: number | null;
  label: string;
  hint: string;
  action?: string;
  onClick: () => void;
  tone?: Tone;
}) {
  const border =
    tone === "urgent"
      ? "border-red-300 bg-red-50"
      : tone === "warn"
        ? "border-amber-300 bg-amber-50"
        : "bg-card";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[112px] flex-col gap-0.5 rounded-lg border p-4 text-left transition hover:shadow-soft ${border} ${
        n === 0 ? "opacity-60" : ""
      }`}
    >
      {n != null && <span className="text-3xl font-semibold leading-tight">{n}</span>}
      <span className="text-sm font-semibold text-primary-deep">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      <span className="mt-auto pt-2 text-xs text-primary">{action} →</span>
    </button>
  );
}

export function EmptyOnly() {
  return (
    <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
      Hier ist gerade nichts zu tun.
    </div>
  );
}

/** Link „Familie“ zur Familienseite (E-Mail als Schlüssel). */
export function FamilyLink({ email }: { email: string }) {
  return (
    <Link
      to="/admin/familie"
      search={{ email }}
      className="text-xs text-muted-foreground underline"
    >
      Familie
    </Link>
  );
}

/** Name des Kindes (öffnet die Anfrage), Link zur Familie und Zuständigkeit. */
export function EntryName({ e, onOpen }: { e: WaitlistEntry; onOpen: (e: WaitlistEntry) => void }) {
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="font-medium text-primary underline underline-offset-2"
        onClick={() => onOpen(e)}
      >
        {e.child_name}
      </button>
      <FamilyLink email={e.parent_email ?? ""} />
      <EntryAssign entry={e} />
    </span>
  );
}
