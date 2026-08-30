import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getMyAdminRoles } from "@/lib/admin-guard.functions";
import { type Role } from "@/lib/nav-items";

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
  return <Outlet />;
}
