import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Menu, X, LogIn } from "lucide-react";
import logoAsset from "@/assets/logo-sicher-schwimmen-v2.jpg.asset.json";
const logo = logoAsset.url;
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const nav = [
  { to: "/", label: "Start" },
  { to: "/kurse", label: "Kurse" },
  { to: "/mitgliedschaft", label: "Mitgliedschaft" },
  { to: "/sicherheit", label: "Sicherheit" },
  { to: "/ueber-uns", label: "Über uns" },
  { to: "/faq", label: "FAQ" },
  { to: "/kontakt", label: "Kontakt" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setHasSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto flex h-20 items-center justify-between px-4">
        <Link to="/" className="flex items-center">
          <img src={logo} alt="Sicher Schwimmen e.V. – Hennef" className="h-16 w-auto object-contain" height={64} />
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-full px-4 py-2 text-sm font-semibold text-foreground/80 transition hover:bg-secondary hover:text-primary-deep"
              activeProps={{ className: "bg-secondary text-primary-deep" }}
              activeOptions={{ exact: n.to === "/" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to={hasSession ? "/portal" : "/auth"}>
              <LogIn className="mr-1.5 h-4 w-4" />
              {hasSession ? "Portal" : "Login"}
            </Link>
          </Button>
          <Button asChild variant="accent" size="sm">
            <Link to="/kurs-anfragen">Kurs anfragen</Link>
          </Button>
        </div>

        <button className="lg:hidden rounded-md p-2" onClick={() => setOpen(!open)} aria-label="Menü">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border bg-background">
          <nav className="container mx-auto flex flex-col p-4 gap-1">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-3 font-semibold hover:bg-secondary">
                {n.label}
              </Link>
            ))}
            <div className="flex gap-2 pt-2 border-t mt-2">
              <Button asChild variant="outline" className="flex-1">
                <Link to={hasSession ? "/portal" : "/auth"} onClick={() => setOpen(false)}>
                  {hasSession ? "Portal" : "Login"}
                </Link>
              </Button>
              <Button asChild variant="accent" className="flex-1">
                <Link to="/kurs-anfragen" onClick={() => setOpen(false)}>Kurs anfragen</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
