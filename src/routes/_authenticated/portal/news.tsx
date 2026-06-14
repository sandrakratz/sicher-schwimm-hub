import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateBerlin } from "@/lib/format";

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
              <div className="text-xs text-accent uppercase font-semibold tracking-wider">
                {n.category}
                {n.published_at && (
                  <span className="ml-2 text-muted-foreground normal-case font-normal">
                    {formatDateBerlin(n.published_at)}
                  </span>
                )}
              </div>
              <h2 className="font-display text-xl font-bold text-primary-deep mt-1">{n.title}</h2>
              {n.excerpt && <p className="text-muted-foreground mt-2 font-medium">{n.excerpt}</p>}
              <div className="text-foreground/90 mt-3 whitespace-pre-line leading-relaxed">{n.content}</div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
