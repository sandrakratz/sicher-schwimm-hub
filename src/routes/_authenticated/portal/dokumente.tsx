import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/portal/dokumente")({
  component: () => (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl font-bold text-primary-deep mb-6">Dokumente</h1>
      <Card className="border-0 shadow-soft"><CardContent className="p-10 text-center text-muted-foreground">Hier finden Sie Satzung, Mitgliedsordnung und weitere Downloads.</CardContent></Card>
    </div>
  ),
});
