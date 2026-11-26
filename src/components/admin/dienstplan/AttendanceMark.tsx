import { useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  confirmTrainerAttendance,
  correctTrainerAttendance,
} from "@/lib/trainer-attendance.functions";
import type { AttendanceState } from "@/lib/dienstplan";
import { AttendanceCorrectDialog } from "./AttendanceCorrectDialog";

/** Kleines Zeichen vor dem Namen: ✓ war da · ✓ (gelb) bestätigen · ✗ nicht da · ? kein Eintrag. */
const MARK: Record<AttendanceState, { glyph: string; cls: string; label: string }> = {
  ok: { glyph: "✓", cls: "bg-green-600 text-white", label: "war anwesend (bestätigt)" },
  recorded: {
    glyph: "✓",
    cls: "bg-amber-400 text-amber-950",
    label: "hat sich als anwesend eingetragen – noch nicht bestätigt",
  },
  absent: { glyph: "✗", cls: "bg-red-600 text-white", label: "war nicht anwesend" },
  none: {
    glyph: "?",
    cls: "border border-amber-600 bg-white text-amber-800",
    label: "kein Eintrag",
  },
};

export function markLabel(state: AttendanceState) {
  return MARK[state].label;
}

export function MarkBadge({ state }: { state: AttendanceState }) {
  const m = MARK[state];
  return (
    <span
      aria-hidden
      className={`mr-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none ${m.cls}`}
    >
      {m.glyph}
    </span>
  );
}

/**
 * Umschließt den Namen/Chip eines Einsatzes und öffnet bei Klick die Auswahl
 * (bestätigen, ablehnen, eintragen). Bei Terminen, die noch nicht vorbei sind, passiert nichts.
 */
export function AttendanceAction({
  state,
  sessionId,
  trainerId,
  trainerName,
  children,
  onChanged,
  inline = false,
}: {
  inline?: boolean;
  state: AttendanceState | null;
  sessionId: string;
  trainerId: string;
  trainerName: string;
  children: ReactNode;
  onChanged: () => void;
}) {
  const confirmFn = useServerFn(confirmTrainerAttendance);
  const correctFn = useServerFn(correctTrainerAttendance);
  // Ziel der Korrektur (anwesend ja/nein), solange das Fenster offen ist
  const [target, setTarget] = useState<boolean | null>(null);

  if (!state) return <>{children}</>;

  async function run(job: () => Promise<unknown>, okText: string) {
    try {
      await job();
      toast.success(okText);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    }
  }

  function setPresent(present: boolean, note: string) {
    setTarget(null);
    void run(
      () => correctFn({ data: { sessionId, trainerId, present, note } }),
      present ? "Als anwesend eingetragen" : "Als nicht anwesend eingetragen",
    );
  }

  return (
    <>
      {target !== null && (
        <AttendanceCorrectDialog
          trainerName={trainerName}
          present={target}
          onClose={() => setTarget(null)}
          onConfirm={(note) => setPresent(target, note)}
        />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={`${trainerName}: ${MARK[state].label} – klicken zum Ändern`}
            className={`${inline ? "inline-flex" : "block w-full"} cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          >
            {children}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {trainerName}: {MARK[state].label}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {state === "recorded" && (
            <DropdownMenuItem
              onSelect={() =>
                void run(
                  () => confirmFn({ data: { sessionId, trainerId, confirm: true } }),
                  "Bestätigt",
                )
              }
            >
              Bestätigen
            </DropdownMenuItem>
          )}
          {state !== "absent" && (
            <DropdownMenuItem className="text-destructive" onSelect={() => setTarget(false)}>
              {state === "none" ? "Als nicht anwesend eintragen" : "Ablehnen (nicht anwesend)"}
            </DropdownMenuItem>
          )}
          {(state === "none" || state === "absent") && (
            <DropdownMenuItem onSelect={() => setTarget(true)}>
              {state === "none" ? "Als anwesend eintragen" : "Doch anwesend"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
