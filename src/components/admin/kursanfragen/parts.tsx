import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUS_CLASS, STATUS_LABEL, type Item } from "./types";

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={STATUS_CLASS[status] || ""}>
      {STATUS_LABEL[status] || status}
    </Badge>
  );
}

/** Markierung „an Schwimmschule Sharky verwiesen“: wer gerade gespeichert wird und wie umgeschaltet wird. */
export type Sharky = { busyId: string | null; toggle: (item: Item) => void };

export function SharkyButton({ item, sharky }: { item: Item; sharky: Sharky }) {
  const active = !!item.referred_sharky;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={sharky.busyId === item.id}
      onClick={(e) => {
        e.stopPropagation();
        sharky.toggle(item);
      }}
      title={
        active
          ? "An Schwimmschule Sharky verwiesen – klicken zum Aufheben"
          : "Als „an Schwimmschule Sharky verwiesen“ markieren"
      }
      className={
        active
          ? "h-7 border-transparent bg-purple-600 px-2 text-xs text-white hover:bg-purple-700"
          : "h-7 px-2 text-xs text-muted-foreground"
      }
    >
      {active ? "✓ Sharky" : "Sharky"}
    </Button>
  );
}

/** Notiz, Gesundheitshinweise und Originalnachricht direkt in der Liste sichtbar machen. */
export function NoteCell({ item }: { item: Item }) {
  const lines = [
    { text: (item.admin_notes || "").trim(), prefix: "", cls: "text-muted-foreground" },
    { text: (item.health_info || "").trim(), prefix: "Gesundheit: ", cls: "text-amber-700" },
    { text: (item.message || "").trim(), prefix: "Nachricht: ", cls: "text-muted-foreground" },
  ].filter((l) => l.text);
  if (!lines.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="space-y-1 text-xs">
      {lines.map((l) => (
        <span key={l.prefix} className={`block truncate ${l.cls}`} title={l.text}>
          {l.prefix}
          {l.text}
        </span>
      ))}
    </div>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="col-span-2">{value}</div>
    </div>
  );
}
