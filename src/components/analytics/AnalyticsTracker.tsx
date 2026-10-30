import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { track, flush } from "@/lib/analytics/client";
import { hasAnalyticsConsent, subscribeConsent } from "@/lib/analytics/consent";

/**
 * Misst Seitenaufrufe, sichtbare Verweildauer und Scrolltiefe.
 * Tut nichts ohne Einwilligung. Bei Widerruf endet die Messung sofort.
 */
export function AnalyticsTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let active = hasAnalyticsConsent();
    let visibleMs = 0;
    let visibleSince = document.visibilityState === "visible" ? Date.now() : null;
    let maxScroll = 0;

    const updateScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      const pct = scrollable <= 0 ? 100 : Math.round((window.scrollY / scrollable) * 100);
      maxScroll = Math.max(maxScroll, Math.min(100, pct));
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && visibleSince !== null) {
        visibleMs += Date.now() - visibleSince;
        visibleSince = null;
      } else if (document.visibilityState === "visible" && visibleSince === null) {
        visibleSince = Date.now();
      }
    };
    const leave = () => {
      if (!active) return;
      if (visibleSince !== null) {
        visibleMs += Date.now() - visibleSince;
        visibleSince = null;
      }
      updateScroll();
      track(
        "page_leave",
        { visible_ms: Math.round(visibleMs), max_scroll_pct: maxScroll },
        undefined,
        pathname,
      );
    };

    if (active) track("page_view", {});
    updateScroll();

    window.addEventListener("scroll", updateScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    // Beim Schließen des Tabs: Verlassen melden und sofort senden
    const onPageHide = () => {
      leave();
      flush(true);
      active = false;
    };
    window.addEventListener("pagehide", onPageHide);
    const unsubscribe = subscribeConsent(() => {
      const was = active;
      active = hasAnalyticsConsent();
      // Erst auf dieser Seite zugestimmt: Aufruf ab jetzt zählen, Verweildauer ab jetzt messen
      if (active && !was) {
        visibleMs = 0;
        visibleSince = document.visibilityState === "visible" ? Date.now() : null;
        track("page_view", {});
      }
    });

    return () => {
      leave();
      window.removeEventListener("scroll", updateScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      unsubscribe();
    };
  }, [pathname]);

  return null;
}
