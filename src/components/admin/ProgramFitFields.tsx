import { Label } from "@/components/ui/label";
import { SWIM_LEVELS } from "@/lib/swim-fit";
import { NativeSelect } from "@/components/ui/native-select";

/** Mindest-Schwimmniveau eines Angebots (Grundlage der „Passt das?“-Prüfung). */
export function ProgramFitFields({
  minSwimLevel,
  onChange,
}: {
  minSwimLevel: number | null | undefined;
  onChange: (v: { min_swim_level?: number | null }) => void;
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
          Vorstand prüft sie im Eingang unter „Passt das?“.
        </p>
      </div>
    </>
  );
}
