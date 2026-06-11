import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "News & Termine – Sicher Schwimmen e.V. Hennef" },
      { name: "description", content: "Aktuelle Neuigkeiten, Termine und Informationen aus dem Schwimmverein Sicher Schwimmen e.V. in Hennef." },
      { property: "og:title", content: "News – Sicher Schwimmen e.V." },
      { property: "og:description", content: "Aktuelle Neuigkeiten, Termine und Informationen aus dem Verein." },
      { property: "og:url", content: "https://sicher-schwimmen.com/news" },
    ],
    links: [{ rel: "canonical", href: "https://sicher-schwimmen.com/news" }],
  }),
  component: Page,
});

type News = {
  id: string;
  title: string;
  excerpt: string | null;
  content: string;
  category: string;
  published_at: string | null;
};

function Page() {
  const [items, setItems] = useState<News[]>([]);
  useEffect(() => {
    supabase
      .from("news")
      .select("id,title,excerpt,content,category,published_at")
      .eq("published", true)
      .eq("visibility", "public")
      .order("published_at", { ascending: false })
      .then(({ data }) => setItems((data as News[]) || []));
  }, []);

  return (
    <PublicLayout>
      <section className="bg-hero text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-display text-5xl font-bold mb-3">News</h1>
          <p className="text-white/85 text-lg">Aktuelles aus dem Verein.</p>
        </div>
      </section>
      <section className="container mx-auto px-4 py-16 max-w-4xl">
        {items.length === 0 ? (
          <Card className="border-0 shadow-soft">
            <CardContent className="p-10 text-center text-muted-foreground">
              Aktuell keine öffentlichen Beiträge.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {items.map((n) => (
              <Card key={n.id} className="border-0 shadow-soft">
                <CardContent className="p-6">
                  <div className="text-xs text-accent uppercase font-semibold tracking-wider">
                    {n.category}
                    {n.published_at && (
                      <span className="ml-2 text-muted-foreground normal-case font-normal">
                        {new Date(n.published_at).toLocaleDateString("de-DE")}
                      </span>
                    )}
                  </div>
                  <h2 className="font-display text-xl font-bold text-primary-deep mt-1">{n.title}</h2>
                  {n.excerpt && (
                    <p className="text-muted-foreground mt-2 font-medium">{n.excerpt}</p>
                  )}
                  <div className="text-foreground/90 mt-3 whitespace-pre-line leading-relaxed">
                    {n.content}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
