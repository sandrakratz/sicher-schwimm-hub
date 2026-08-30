import { Link } from "@tanstack/react-router";
import { AI_IMAGE_NOTICE } from "@/lib/labels";
import { cn } from "@/lib/utils";

/**
 * Zentraler Hinweis auf KI-generierte Abbildungen inkl. Verweis auf die
 * Bildnachweise im Impressum.
 */
export function AiImageNotice({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {AI_IMAGE_NOTICE} – siehe{" "}
      <Link to="/impressum" hash="bildnachweise" className="underline">
        Bildnachweise
      </Link>
      .
    </p>
  );
}
