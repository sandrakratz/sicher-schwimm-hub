import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

function placeholder(title: string) {
  return function P() {
    return (
      <div className="max-w-4xl">
        <h1 className="font-display text-3xl font-bold text-primary-deep mb-6">{title}</h1>
        <Card className="border-0 shadow-soft"><CardContent className="p-10 text-center text-muted-foreground">Verwaltungs-UI für {title} folgt in der nächsten Iteration.</CardContent></Card>
      </div>
    );
  };
}

export const Route = createFileRoute("/_authenticated/admin/benutzer")({
  component: placeholder("Benutzerverwaltung"),
});
