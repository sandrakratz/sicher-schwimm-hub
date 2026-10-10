import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WaitlistAdmin } from "@/components/admin/WaitlistAdmin";
import { CourseRequestsAdmin } from "@/components/admin/CourseRequestsAdmin";

export const Route = createFileRoute("/_authenticated/admin/warteliste")({
  // ?tab=archive öffnet direkt „Frühere Kursanfragen“ (Links aus Posteingang und Dashboard)
  validateSearch: (search: Record<string, unknown>): { tab?: "archive" } =>
    search["tab"] === "archive" ? { tab: "archive" } : {},
  beforeLoad: async () => {
    const { assertHasAnyRole } = await import("@/lib/role-guard");
    const { redirect } = await import("@tanstack/react-router");
    try {
      await assertHasAnyRole({ data: { roles: ["admin", "board"] } });
    } catch {
      throw redirect({ to: "/admin/benutzer" });
    }
  },
  component: WaitlistPage,
});

function WaitlistPage() {
  const { tab } = Route.useSearch();
  return (
    <Tabs defaultValue={tab ?? "waiting"} className="space-y-6">
      <TabsList>
        <TabsTrigger value="waiting">Anfrageliste</TabsTrigger>
        <TabsTrigger value="archive">Frühere Kursanfragen</TabsTrigger>
      </TabsList>

      <TabsContent value="waiting" className="space-y-10">
        <WaitlistAdmin />
      </TabsContent>

      <TabsContent value="archive" className="space-y-4">
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-semibold">Archiv – nur noch zum Nachlesen</p>
          <p className="text-muted-foreground">
            Neue Anmeldungen laufen ausschließlich über die Warteliste. Hier stehen die alten
            Kursanfragen sowie die automatisch erzeugten Buchungsbelege.
          </p>
        </div>
        <CourseRequestsAdmin mode="all" />
      </TabsContent>
    </Tabs>
  );
}
