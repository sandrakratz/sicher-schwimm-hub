import { Badge } from "@/components/ui/badge";

/** „seit N Tagen offen“: ab 2 Tagen gelb, ab 4 Tagen rot. */
export function AgeBadge({ since }: { since: string }) {
  const days = Math.floor((Date.now() - new Date(since).getTime()) / 86400000);
  const label =
    days <= 0 ? "heute eingegangen" : `seit ${days} ${days === 1 ? "Tag" : "Tagen"} offen`;
  const cls =
    days >= 4
      ? "bg-red-100 text-red-900"
      : days >= 2
        ? "bg-amber-100 text-amber-900"
        : "bg-slate-100 text-slate-700";
  return (
    <Badge variant="secondary" className={cls}>
      {label}
    </Badge>
  );
}
