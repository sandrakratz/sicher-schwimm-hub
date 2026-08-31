import { createFileRoute } from "@tanstack/react-router";
import { WaitlistAdmin } from "@/components/admin/WaitlistAdmin";

export const Route = createFileRoute("/_authenticated/admin/warteliste")({
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/admin-guard.functions");
    const { redirect } = await import("@tanstack/react-router");
    try { await assertHasAnyRole({ data: { roles: ["admin", "board"] } }); }
    catch { throw redirect({ to: "/admin/benutzer" }); }
  },
  component: WaitlistPage,
});

function WaitlistPage() {
  return (
    <div className="space-y-10">
      <WaitlistAdmin />
    </div>
  );
}

