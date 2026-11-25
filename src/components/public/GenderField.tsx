import { useId } from "react";
import { Label } from "@/components/ui/label";
import { GENDERS, type Gender } from "./membership-form";

/**
 * Auswahl „Geschlecht“ (weiblich/männlich/divers) – für die Bestandsmeldung an den Landessportbund.
 * Ungesteuert mit `name` (Formular) oder gesteuert mit `value`/`onChange` (Familienangaben).
 */
export function GenderField({
  id,
  name,
  required,
  value,
  onChange,
}: {
  id?: string;
  name?: string;
  required?: boolean;
  value?: Gender | "";
  onChange?: (v: Gender | "") => void;
}) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>Geschlecht{required ? " *" : ""}</Label>
      <select
        id={fieldId}
        name={name}
        required={required}
        {...(onChange
          ? { value: value ?? "", onChange: (e) => onChange(e.target.value as Gender | "") }
          : { defaultValue: "" })}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="" disabled={required}>
          Bitte auswählen
        </option>
        {GENDERS.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </select>
    </div>
  );
}
