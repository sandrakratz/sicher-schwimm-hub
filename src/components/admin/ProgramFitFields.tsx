import { Label } from "@/components/ui/label";
import { SWIM_LEVELS, WEEKDAYS } from "@/lib/swim-fit";
import { NativeSelect } from "@/components/ui/native-select";

/** Mindest-Schwimmniveau und Kurstag eines Angebots (Grundlage der „Passt das?“-Prüfung). */
export function ProgramFitFields({
  minSwimLevel,
  weekday,
  onChange,
}: {
  minSwimLevel: number | null | undefined;
  weekday: number | null | undefined;
  onChange: (v: { min_swim_level?: number | null; weekday?: number | null }) => void;
}) {
  return (
    <>
      <div>
        <Label>Mindest-Schwimmniveau</Label>
        <NativeSelect
          className="mt-1 w-full"
          value={minSwimLevel ?? ""}
          onChange={(e) =>
            onChange({ min_swim_level: e.target.value === "" ? null : Number(e.target.value) })
          }
        >
          <option value="">Keine Prüfung</option>
          <option value="0">Kein Mindest-Niveau</option>
          {SWIM_LEVELS.filter((l) => l.value > 0).map((l) => (
            <option key={l.value} value={l.value}>
              mindestens: {l.label}
            </option>
          ))}
        </NativeSelect>
        <p className="mt-1 text-xs text-muted-foreground">
          Familien mit niedrigerem oder unbekanntem Niveau bekommen keinen automatischen Platz; der
          Vorstand prüft sie unter „Heute“ → „Passt das?“.
        </p>
      </div>
      <div>
        <Label>Kurstag</Label>
        <NativeSelect
          className="mt-1 w-full"
          value={weekday ?? ""}
          onChange={(e) =>
            onChange({ weekday: e.target.value === "" ? null : Number(e.target.value) })
          }
        >
          <option value="">Keine Prüfung</option>
          {WEEKDAYS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </NativeSelect>
        <p className="mt-1 text-xs text-muted-foreground">
          Nennen die Eltern einen anderen Wunschtag, wird nicht automatisch angeboten.
        </p>
      </div>
    </>
  );
}
