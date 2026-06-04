import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, FileText, Newspaper, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/")({
  component: Dashboard,
});

function Dashboard() {
  const [name, setName] = useState("");
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("first_name").eq("id", data.user.id).maybeSingle();
      setName(p?.first_name || data.user.email?.split("@")[0] || "");
    });
  }, []);

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <div className="text-accent font-semibold text-sm uppercase tracking-wider">Willkommen</div>
        <h1 className="font-display text-4xl font-bold text-primary-deep">Hallo {name}! 👋</h1>
        <p className="text-muted-foreground mt-2">Schön, dass Sie da sind. Hier finden Sie Ihre wichtigsten Vereinsinfos.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: UserIcon, label: "Mitgliedschaft", value: "Aktiv" },
          { icon: Newspaper, label: "Neue Beiträge", value: "—" },
          { icon: Calendar, label: "Kommende Termine", value: "—" },
          { icon: FileText, label: "Dokumente", value: "—" },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-soft">
            <CardContent className="p-5">
              <s.icon className="h-7 w-7 text-accent mb-3" />
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{s.label}</div>
              <div className="text-2xl font-bold text-primary-deep">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-soft">
          <CardContent className="p-6">
            <h2 className="font-display text-xl font-bold text-primary-deep mb-3">Vereinsnews</h2>
            <p className="text-sm text-muted-foreground">Aktuell liegen keine Beiträge vor.</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-soft">
          <CardContent className="p-6">
            <h2 className="font-display text-xl font-bold text-primary-deep mb-3">Kommende Termine</h2>
            <p className="text-sm text-muted-foreground">Aktuell sind keine Termine geplant.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
