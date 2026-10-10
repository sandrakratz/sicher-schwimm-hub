import { createFileRoute, redirect, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getMyAdminRoles } from "@/lib/role-guard";
import { type Role, findAdminSection } from "@/lib/nav-items";

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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const section = findAdminSection(pathname);
  return (
    <>
      {section && (
        <div className="mb-6 max-w-6xl">
          <div className="text-accent font-semibold text-xs uppercase tracking-wider mb-2">
            {section.label}
          </div>
          <div className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border">
            {section.tabs.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-muted-foreground border-b-2 border-transparent -mb-px hover:text-primary-deep"
                activeProps={{ className: "!text-primary-deep !border-accent" }}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      )}
      <Outlet />
    </>
  );
}
