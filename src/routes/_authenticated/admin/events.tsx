import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/events")({
  component: () => (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl font-bold text-primary-deep mb-6">Eventverwaltung</h1>
      <Card className="border-0 shadow-soft"><CardContent className="p-10 text-center text-muted-foreground">Eventverwaltung folgt.</CardContent></Card>
    </div>
  ),
});
