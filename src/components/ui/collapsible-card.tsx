import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CollapsibleCardProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Shown in the header row, right of the title (badges, counters). Not clickable area content. */
  meta?: React.ReactNode;
  /** Shown in the header row on the far right (buttons). Clicks do not toggle. */
  actions?: React.ReactNode;
  defaultOpen?: boolean;
  /** Persist open state under this key in localStorage. */
  storageKey?: string;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
};

export function CollapsibleCard({
  title,
  subtitle,
  meta,
  actions,
  defaultOpen = true,
  storageKey,
  className,
  contentClassName,
  children,
}: CollapsibleCardProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  React.useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(`cc:${storageKey}`);
      if (saved === "0") setOpen(false);
      if (saved === "1") setOpen(true);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  function toggle() {
    setOpen(prev => {
      const next = !prev;
      if (storageKey) {
        try {
          localStorage.setItem(`cc:${storageKey}`, next ? "1" : "0");
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex flex-wrap items-center gap-2 p-4">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")}
          />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-primary-deep">{title}</span>
            {subtitle ? <span className="block text-xs text-muted-foreground">{subtitle}</span> : null}
          </span>
        </button>
        {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {open ? <CardContent className={cn("pt-0", contentClassName)}>{children}</CardContent> : null}
    </Card>
  );
}
