import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

function makePlaceholder(title: string, text: string) {
  return function P() {
    return (
      <div className="max-w-4xl">
        <h1 className="font-display text-3xl font-bold text-primary-deep mb-2">{title}</h1>
        <p className="text-muted-foreground mb-6">{text}</p>
        <Card className="border-0 shadow-soft"><CardContent className="p-10 text-center text-muted-foreground">Hier erscheinen bald Ihre Inhalte.</CardContent></Card>
      </div>
    );
  };
}

export const Route = createFileRoute("/_authenticated/portal/kurse")({
  component: makePlaceholder("Meine Kurse", "Übersicht über Ihre Schwimmkurse, Trainer und Termine."),
});
