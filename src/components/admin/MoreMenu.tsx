import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type MoreMenuItem = {
  label: string;
  /** Ein Satz zur Folge, z. B. „Bestätigung geht sofort an die Eltern“. */
  hint?: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Endgültiges (Löschen): steht immer zuletzt, abgesetzt und rot. */
  destructive?: boolean;
};

/**
 * Menü „Weitere“ (Bedienregeln 2 und 3): seltene Aktionen hinter einem beschrifteten Knopf, jede mit
 * einem Satz zur Folge; Endgültiges immer zuletzt, abgesetzt und rot.
 */
export function MoreMenu({ items, label = "Weitere" }: { items: MoreMenuItem[]; label?: string }) {
  const normal = items.filter((i) => !i.destructive);
  const danger = items.filter((i) => i.destructive);
  if (items.length === 0) return null;
  const render = (i: MoreMenuItem) => (
    <DropdownMenuItem
      key={i.label}
      disabled={i.disabled}
      onSelect={i.onSelect}
      className={`flex flex-col items-start gap-0.5 ${i.destructive ? "text-destructive focus:text-destructive" : ""}`}
    >
      <span className="font-medium">{i.label}</span>
      {i.hint && <span className="text-xs text-muted-foreground">{i.hint}</span>}
    </DropdownMenuItem>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost">
          {label} <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {normal.map(render)}
        {normal.length > 0 && danger.length > 0 && <DropdownMenuSeparator />}
        {danger.map(render)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
