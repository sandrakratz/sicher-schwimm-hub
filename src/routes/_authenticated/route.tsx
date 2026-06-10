import { Outlet, Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { LayoutDashboard, User, Calendar, FileText, Newspaper, Mail, LogOut, Waves, Shield, BookOpen } from "lucide-react";
import logoAsset from "@/assets/sicher-schwimmen-rund.png.asset.json";
const logo = logoAsset.url;
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
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
  const [isStaff, setIsStaff] = useState(false);
  const [name, setName] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      setIsStaff(!!roles?.some(r => r.role === "admin" || r.role === "board"));
      const { data: profile } = await supabase.from("profiles").select("first_name,last_name").eq("id", u.user.id).maybeSingle();
      setName([profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || u.user.email || "");
    })();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    toast.success("Abgemeldet");
    navigate({ to: "/" });
  }

  const portalNav = [
    { to: "/portal", icon: LayoutDashboard, label: "Übersicht" },
    { to: "/portal/profil", icon: User, label: "Mein Profil" },
    { to: "/portal/kurse", icon: BookOpen, label: "Meine Kurse" },
    { to: "/portal/news", icon: Newspaper, label: "Vereinsnews" },
    { to: "/portal/events", icon: Calendar, label: "Termine" },
    { to: "/portal/dokumente", icon: FileText, label: "Dokumente" },
    { to: "/portal/kontakt", icon: Mail, label: "Verein kontaktieren" },
  ];

  return (
    <div className="min-h-screen flex bg-surface">
      <aside className="hidden lg:flex w-64 flex-col bg-sidebar text-sidebar-foreground shrink-0">
        <Link to="/" className="flex flex-col items-center gap-2 p-4 border-b border-sidebar-border">
          <img src={logo} alt="Sicher Schwimmen e.V." className="h-20 w-auto object-contain" height={80} />
          <div className="text-xs font-semibold opacity-90">Mitgliederportal</div>
        </Link>
        <nav className="p-3 flex-1 space-y-1">
          {portalNav.map(n => (
            <Link key={n.to} to={n.to}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-sidebar-accent transition"
              activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground" }}
              activeOptions={{ exact: n.to === "/portal" }}>
              <n.icon className="h-4 w-4" />{n.label}
            </Link>
          ))}
          {isStaff && (
            <Link to="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold bg-accent/15 text-accent hover:bg-accent/25 transition mt-4">
              <Shield className="h-4 w-4" />Admin-Bereich
            </Link>
          )}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 text-xs opacity-70 truncate">{name}</div>
          <Button onClick={logout} variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" />Abmelden
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden bg-sidebar text-sidebar-foreground p-4 flex items-center justify-between">
          <Link to="/portal" className="flex items-center gap-2 font-bold"><Waves className="h-5 w-5" /> Portal</Link>
          <Button onClick={logout} variant="ghost" size="sm" className="text-sidebar-foreground"><LogOut className="h-4 w-4" /></Button>
        </header>
        <main className="flex-1 p-6 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
