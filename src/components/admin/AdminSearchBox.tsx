import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";

/**
 * Suchfeld oben in der Seitenleiste der Verwaltung (Bedienregel 10): von jeder Seite aus Kind oder
 * Familie finden; Enter öffnet die Gesamtsuche mit dem Begriff. Strg+K (Mac: ⌘K) springt ins Feld.
 */
export function AdminSearchBox() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") {
        // Das Feld gibt es in Seitenleiste und Handy-Menü – das sichtbare nehmen
        const field = [
          ...document.querySelectorAll<HTMLInputElement>("input[data-admin-search]"),
        ].find((el) => el.offsetParent !== null);
        if (field) {
          ev.preventDefault();
          field.focus();
          field.select();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      className="mx-3 mt-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        const term = q.trim();
        void navigate({ to: "/admin/suche", search: term ? { q: term } : {} });
      }}
    >
      <label className="relative block">
        <span className="sr-only">Kind oder Familie finden</span>
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-70"
          aria-hidden="true"
        />
        <input
          data-admin-search
          type="search"
          value={q}
          onChange={(ev) => setQ(ev.target.value)}
          placeholder="Kind/Familie suchen"
          className="w-full rounded-lg bg-sidebar-accent py-2 pl-8 pr-12 text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/60 focus:outline-none focus:ring-2 focus:ring-sidebar-primary"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-sidebar-border px-1 text-[10px] opacity-70">
          Strg K
        </kbd>
      </label>
    </form>
  );
}
