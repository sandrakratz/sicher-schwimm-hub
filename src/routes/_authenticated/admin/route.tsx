import { createFileRoute, redirect, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Shield, LogOut, Menu } from "lucide-react";
import logoAsset from "@/assets/sicher-schwimmen-rund.png.asset.json";
const logo = logoAsset.url;
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getMyAdminRoles } from "@/lib/admin-guard.functions";
import { portalNav, visibleAdminNav, type Role } from "@/lib/nav-items";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    let roles: Role[] = [];
    try {
      const res = await getMyAdminRoles();
      roles = res.roles as Role[];
    } catch {
      throw redirect({ to: "/portal" });
    }
    const isStaff = roles.includes("admin") || roles.includes("board");
    // Trainer ohne Staff-Rolle hat keine /admin Übersicht: leite auf Mitgliederliste
    if (!isStaff && roles.includes("trainer") && location.pathname === "/admin") {
      throw redirect({ to: "/admin/benutzer" });
    }
    return { adminRoles: roles };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const { adminRoles } = Route.useRouteContext();
  const roles = (adminRoles ?? []) as Role[];
  const [name, setName] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setName(data.user?.email || ""));
  }, []);
  async function logout() {
    await supabase.auth.signOut();
    toast.success("Abgemeldet");
    navigate({ to: "/" });
  }

  const visibleNav = visibleAdminNav(roles);

  const navContent = (
    <>
      <Link to="/" className="p-4 border-b border-white/10 flex items-center gap-3">
        <img src={logo} alt="Sicher Schwimmen e.V." className="h-14 w-auto object-contain" height={56} />
        <div className="text-white">
          <div className="font-display font-bold leading-none">Mitgliederportal</div>
        </div>
      </Link>
      <nav className="p-3 flex-1 space-y-1 overflow-y-auto">
        {portalNav.map(n => (
          <Link key={n.to} to={n.to} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-white/10 transition"
            activeProps={{ className: "bg-accent text-accent-foreground" }}
            activeOptions={{ exact: n.exact }}>
            <n.icon className="h-4 w-4" />{n.label}
          </Link>
        ))}
        {visibleNav.length > 0 && (
          <>
            <div className="px-3 pt-5 pb-1 text-[11px] uppercase tracking-wider opacity-60 font-bold">Verwaltung</div>
            {visibleNav.map(n => (
              <Link key={n.to} to={n.to} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-white/10 transition"
                activeProps={{ className: "bg-accent text-accent-foreground" }}
                activeOptions={{ exact: n.exact }}>
                <n.icon className="h-4 w-4" />{n.label}
              </Link>
            ))}
          </>
        )}
      </nav>
      <div className="p-3 border-t border-white/10">
        <div className="px-3 py-2 text-xs opacity-70 truncate">{name}</div>
        <Button onClick={logout} variant="ghost" className="w-full justify-start text-white hover:bg-white/10">
          <LogOut className="h-4 w-4" />Abmelden
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-surface">
      <aside className="hidden lg:flex w-64 flex-col bg-primary-deep text-white shrink-0">
        {navContent}
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden bg-primary-deep text-white p-4 flex items-center justify-between">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" aria-label="Menü öffnen">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-primary-deep text-white border-white/10 flex flex-col">
              <SheetHeader className="sr-only"><SheetTitle>Admin Menü</SheetTitle></SheetHeader>
              {navContent}
            </SheetContent>
          </Sheet>
          <Link to="/admin" className="flex items-center gap-2 font-bold"><Shield className="h-5 w-5" /> Admin</Link>
          <Button onClick={logout} variant="ghost" size="sm" className="text-white hover:bg-white/10" aria-label="Abmelden"><LogOut className="h-4 w-4" /></Button>
        </header>
        <main className="flex-1 p-6 lg:p-10 overflow-x-auto"><Outlet /></main>
      </div>
    </div>
  );
}
