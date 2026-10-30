import { Link, useRouterState } from "@tanstack/react-router";
import { trainerNav } from "@/lib/nav-items";
import { useReplacementCount } from "@/lib/use-replacement-count";

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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const replacementCount = useReplacementCount(pathname.startsWith("/trainer"));
  if (!pathname.startsWith("/trainer")) return null;

  return (
    <>
      <div className="h-20 md:hidden" aria-hidden="true" />
      <nav
        aria-label="Trainerbereich"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-4">
          {trainerNav.map((n) => (
            <li key={n.to}>
              <Link
                to={n.to}
                activeOptions={{ exact: n.exact }}
                activeProps={{ className: "text-primary" }}
                className="flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold text-muted-foreground"
              >
                <span className="relative">
                  <n.icon className="h-5 w-5" />
                  {n.to === "/trainer/verfuegbarkeit" && replacementCount > 0 && (
                    <span className="absolute -right-3 -top-2 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-amber-950">
                      {replacementCount}
                      <span className="sr-only"> Termine suchen Ersatz</span>
                    </span>
                  )}
                </span>
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
