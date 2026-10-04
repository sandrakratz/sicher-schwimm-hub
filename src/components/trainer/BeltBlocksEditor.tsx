import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { updateParticipantBelt, type PreviousBelt } from "@/lib/trainer-courses.functions";
import { beltLabel } from "@/lib/belt";
import { formatDateBerlin } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Auswahl der Klötzchen am Gurt: 6 = Anfänger, 0 = schwimmt ohne Gurt. */
const STEPS = [6, 5, 4, 3, 2, 1, 0] as const;

/**
 * Gurt-Stand eines Kindes erfassen. Je mehr das Kind kann, desto mehr Klötzchen werden entfernt.
 * Ein Tipp speichert sofort. Hat das Kind noch keinen Stand, wird der letzte Stand aus einem früheren
 * Kurs angeboten und lässt sich mit einem Tipp übernehmen.
 */
export function BeltBlocksEditor({
  participantId,
  value,
  previous,
  onSaved,
}: {
  participantId: string;
  value: number | null;
  previous: PreviousBelt | null;
  onSaved?: (participantId: string, blocks: number | null) => void;
}) {
  const save = useServerFn(updateParticipantBelt);
  const [saving, setSaving] = useState(false);
  const origin = previous
    ? [previous.course_name, previous.date ? formatDateBerlin(previous.date) : null]
        .filter(Boolean)
        .join(", ")
    : "";

  async function set(blocks: number | null) {
    setSaving(true);
    try {
      const res = await save({ data: { participantId, blocks } });
      onSaved?.(participantId, res.belt_blocks);
      toast.success(`Gurt gespeichert: ${beltLabel(res.belt_blocks)}`);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold">
        Gurt: <span className="font-normal">{beltLabel(value)}</span>
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Klötzchen am Gurt">
        {STEPS.map((n) => (
          <Button
            key={n}
            type="button"
            size="sm"
            variant={value === n ? "default" : "outline"}
            className={cn("min-h-11 min-w-11", n === 0 && "px-3")}
            disabled={saving}
            aria-pressed={value === n}
            onClick={() => set(n)}
          >
            {n === 0 ? "ohne" : n}
          </Button>
        ))}
        {value != null && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-11"
            disabled={saving}
            onClick={() => set(null)}
          >
            zurücksetzen
          </Button>
        )}
      </div>
      {previous && value == null && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-2 py-1.5 text-xs text-sky-900">
          <span>
            Zuletzt: <strong>{beltLabel(previous.blocks)}</strong>
            {origin && ` (${origin})`}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-9"
            disabled={saving}
            onClick={() => set(previous.blocks)}
          >
            Übernehmen
          </Button>
        </div>
      )}
      {previous && value != null && (
        <p className="text-[11px] text-muted-foreground">
          Zuletzt im Kurs davor: {beltLabel(previous.blocks)}
        </p>
      )}
    </div>
  );
}

export default BeltBlocksEditor;
