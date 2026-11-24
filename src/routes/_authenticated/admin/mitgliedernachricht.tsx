import { createFileRoute } from "@tanstack/react-router";
import { MemberMessage } from "@/components/admin/versand/MemberMessage";

export const Route = createFileRoute("/_authenticated/admin/mitgliedernachricht")({
  ssr: false,
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board"] } });
    } catch {
      throw redirect({ to: "/portal" });
    }
  },
  component: MemberMessage,
});
