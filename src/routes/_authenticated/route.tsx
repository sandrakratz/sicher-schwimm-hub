import {
  Outlet,
  Link,
  createFileRoute,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { LogOut, Waves, Menu } from "lucide-react";
import logo from "@/assets/sicher-schwimmen-rund.png";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { toast } from "sonner";
import { portalNav, visibleAdminNav, visibleTrainerNav, type Role } from "@/lib/nav-items";
import { TrainerMobileNav } from "@/components/trainer/TrainerMobileNav";
import { SkipLink } from "@/components/SkipLink";
import { clearOfflineData } from "@/lib/offline-store";
import { clearShellCache, registerServiceWorker } from "@/lib/register-sw";
import { useReplacementCount } from "@/lib/use-replacement-count";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // Mitglieder-, Trainer- und Verwaltungsbereich: nie in Suchmaschinen
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  beforeLoad: async () => {
    // Ohne Netz (Offline-Modus am Beckenrand) zählt die lokal gespeicherte Anmeldung
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) throw redirect({ to: "/auth" });
      return { user: s.session.user };
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.status && profile.status !== "active") {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { pending: "1" } as any });
    }
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<Role[]>([]);
  const [name, setName] = useState<string>("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Service Worker für Push und Offline-Nutzung (nur im Trainerbereich nötig)
  useEffect(() => {
    if (pathname.startsWith("/trainer")) void registerServiceWorker();
  }, [pathname]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      setRoles((r ?? []).map((x) => x.role as Role));
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name,last_name")
        .eq("id", u.user.id)
        .maybeSingle();
      setName(
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || u.user.email || "",
      );
    })();
  }, []);

  async function logout() {
    // Offline gespeicherte Teilnehmerdaten gehören nicht auf ein Gerät, an dem niemand mehr angemeldet ist
    await clearOfflineData();
    await clearShellCache();
    await supabase.auth.signOut();
    toast.success("Abgemeldet");
    navigate({ to: "/" });
  }

  const adminItems = visibleAdminNav(roles);
  const trainerItems = visibleTrainerNav(roles);
  const replacementCount = useReplacementCount(trainerItems.length > 0);

  const navContent = (
    <>
      <Link to="/" className="flex flex-col items-center gap-2 p-4 border-b border-sidebar-border">
        <img
          src={logo}
          alt="Sicher Schwimmen e.V."
          className="h-20 w-auto object-contain"
          height={80}
        />
        <div className="text-xs font-semibold opacity-90">Mitgliederportal</div>
      </Link>
      <nav className="p-3 flex-1 space-y-1 overflow-y-auto">
        {portalNav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-sidebar-accent transition"
            activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground" }}
            activeOptions={{ exact: n.exact }}
          >
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        ))}
        {trainerItems.length > 0 && (
          <>
            <div className="px-3 pt-5 pb-1 text-[11px] uppercase tracking-wider opacity-60 font-bold">
              Trainer:innen
            </div>
            {trainerItems.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-sidebar-accent transition"
                activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground" }}
                activeOptions={{ exact: n.exact }}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
                {n.to === "/trainer/verfuegbarkeit" && replacementCount > 0 && (
                  <span
                    className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-amber-950"
                    title="Ersatz gesucht"
                  >
                    {replacementCount}
                    <span className="sr-only"> Termine suchen Ersatz</span>
                  </span>
                )}
              </Link>
            ))}
          </>
        )}
        {adminItems.length > 0 && (
          <>
            <div className="px-3 pt-5 pb-1 text-[11px] uppercase tracking-wider opacity-60 font-bold">
              Verwaltung
            </div>
            {adminItems.map((n) => {
              const groupActive = n.group?.some((p) => pathname.startsWith(p));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-sidebar-accent transition ${groupActive ? "bg-sidebar-primary text-sidebar-primary-foreground" : ""}`}
                  activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground" }}
                  activeOptions={{ exact: n.exact }}
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <div className="px-3 py-2 text-xs opacity-70 truncate">{name}</div>
        <Button
          onClick={logout}
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" />
          Abmelden
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-surface">
      <SkipLink />
      {/* Fest am Fensterrand: Menü scrollt für sich, „Abmelden“ bleibt immer sichtbar */}
      <aside
        aria-label="Hauptmenü"
        className="hidden lg:flex w-64 flex-col bg-sidebar text-sidebar-foreground shrink-0 lg:sticky lg:top-0 lg:h-screen"
      >
        {navContent}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden bg-sidebar text-sidebar-foreground p-4 flex items-center justify-between">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-sidebar-foreground"
                aria-label="Menü öffnen"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="p-0 w-72 bg-sidebar text-sidebar-foreground border-sidebar-border flex flex-col"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Mitgliederportal Menü</SheetTitle>
              </SheetHeader>
              {navContent}
            </SheetContent>
          </Sheet>
          <Link to="/portal" className="flex items-center gap-2 font-bold">
            <Waves className="h-5 w-5" /> Portal
          </Link>
          <Button
            onClick={logout}
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground"
            aria-label="Abmelden"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 p-4 sm:p-6 lg:p-10 outline-none">
          <Outlet />
          <TrainerMobileNav />
        </main>
      </div>
    </div>
  );
}
