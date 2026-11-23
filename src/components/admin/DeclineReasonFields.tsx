import { Input } from "@/components/ui/input";
import { DECLINE_REASONS } from "@/lib/decline-reasons";
import { NativeSelect } from "@/components/ui/native-select";

/** Absagegrund: feste Auswahl plus optionale Ergänzung (für die spätere Auswertung). */
export function DeclineReasonFields({
  category,
  detail,
  onCategory,
  onDetail,
}: {
  category: string;
  detail: string;
  onCategory: (v: string) => void;
  onDetail: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs text-muted-foreground">Grund</label>
      <NativeSelect
        className="w-full"
        value={category}
        onChange={(e) => onCategory(e.target.value)}
      >
        <option value="">Keine Angabe</option>
        {DECLINE_REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </NativeSelect>
      <Input
        value={detail}
        onChange={(e) => onDetail(e.target.value)}
        maxLength={400}
        placeholder="Ergänzung (optional)"
      />
    </div>
  );
}
