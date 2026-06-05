import { createFileRoute, redirect, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Users, BookOpen, ListChecks, Newspaper, FileText, Calendar, MailOpen, ScrollText, LogOut, ArrowLeft } from "lucide-react";
import logoAsset from "@/assets/sicher-schwimmen-rund.png.asset.json";
const logo = logoAsset.url;
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const ok = !!roles?.some(r => r.role === "admin" || r.role === "board");
    if (!ok) throw redirect({ to: "/portal" });
  },
  component: AdminLayout,
});

const adminNav = [
  { to: "/admin", icon: Shield, label: "Übersicht", exact: true },
  { to: "/admin/benutzer", icon: Users, label: "Benutzer" },
  { to: "/admin/mitgliedschaften", icon: ListChecks, label: "Mitgliedschaften" },
  { to: "/admin/kurse", icon: BookOpen, label: "Kurse" },
  { to: "/admin/anfragen", icon: ListChecks, label: "Kursanfragen" },
  { to: "/admin/news", icon: Newspaper, label: "News" },
  { to: "/admin/dokumente", icon: FileText, label: "Dokumente" },
  { to: "/admin/events", icon: Calendar, label: "Events" },
  { to: "/admin/nachrichten", icon: MailOpen, label: "Nachrichten" },
  { to: "/admin/audit", icon: ScrollText, label: "Audit-Log" },
];

function AdminLayout() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setName(data.user?.email || ""));
  }, []);
  async function logout() {
    await supabase.auth.signOut();
    toast.success("Abgemeldet");
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen flex bg-surface">
      <aside className="hidden lg:flex w-64 flex-col bg-primary-deep text-white shrink-0">
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <img src={logo} alt="Sicher Schwimmen e.V." className="h-14 w-auto object-contain" height={56} />
          <div className="text-white">
            <div className="font-display font-bold leading-none">Admin</div>
          </div>
        </div>
        <nav className="p-3 flex-1 space-y-1">
          {adminNav.map(n => (
            <Link key={n.to} to={n.to} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-white/10 transition"
              activeProps={{ className: "bg-accent text-accent-foreground" }}
              activeOptions={{ exact: n.exact }}>
              <n.icon className="h-4 w-4" />{n.label}
            </Link>
          ))}
          <Link to="/portal" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-white/10 mt-4">
            <ArrowLeft className="h-4 w-4" />Zurück zum Portal
          </Link>
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="px-3 py-2 text-xs opacity-70 truncate">{name}</div>
          <Button onClick={logout} variant="ghost" className="w-full justify-start text-white hover:bg-white/10">
            <LogOut className="h-4 w-4" />Abmelden
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-6 lg:p-10 overflow-x-auto"><Outlet /></main>
    </div>
  );
}
