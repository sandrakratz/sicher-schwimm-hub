import { Input } from "@/components/ui/input";
import { DECLINE_REASONS } from "@/lib/decline-reasons";

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
      <select
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        value={category}
        onChange={(e) => onCategory(e.target.value)}
      >
        <option value="">Keine Angabe</option>
        {DECLINE_REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <Input
        value={detail}
        onChange={(e) => onDetail(e.target.value)}
        maxLength={400}
        placeholder="Ergänzung (optional)"
      />
    </div>
  );
}
