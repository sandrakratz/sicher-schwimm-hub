import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/portal/news")({
  component: NewsList,
});

function NewsList() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("news").select("*").eq("published", true).order("published_at", { ascending: false }).then(({ data }) => setItems(data || []));
  }, []);
  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl font-bold text-primary-deep mb-6">Vereinsnews</h1>
      {items.length === 0 ? (
        <Card className="border-0 shadow-soft"><CardContent className="p-10 text-center text-muted-foreground">Aktuell keine Beiträge.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {items.map(n => (
            <Card key={n.id} className="border-0 shadow-soft"><CardContent className="p-6">
              <div className="text-xs text-accent uppercase font-semibold tracking-wider">{n.category}</div>
              <h2 className="font-display text-xl font-bold text-primary-deep">{n.title}</h2>
              <p className="text-muted-foreground mt-2">{n.excerpt || n.content?.slice(0, 200)}</p>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
