import { Link, useRouterState } from "@tanstack/react-router";
import { trainerNav } from "@/lib/nav-items";

const SHORT_LABEL: Record<string, string> = {
  "/trainer": "Start",
  "/trainer/verfuegbarkeit": "Zeiten",
  "/trainer/kurse": "Kurse",
  "/trainer/mitglieder": "Mitglieder",
};

/**
 * Feste untere Navigationsleiste im Trainerbereich – nur auf kleinen Displays.
 */
export function TrainerMobileNav() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  if (!pathname.startsWith("/trainer")) return null;

  return (
    <>
      <div className="h-20 md:hidden" aria-hidden="true" />
      <nav
        aria-label="Trainerbereich"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-4">
          {trainerNav.map(n => (
            <li key={n.to}>
              <Link
                to={n.to}
                activeOptions={{ exact: n.exact }}
                activeProps={{ className: "text-primary" }}
                className="flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold text-muted-foreground"
              >
                <n.icon className="h-5 w-5" />
                <span className="truncate">{SHORT_LABEL[n.to] ?? n.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

export default TrainerMobileNav;
