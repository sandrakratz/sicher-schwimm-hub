import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Eye, Heart, Users, Sparkles, Accessibility } from "lucide-react";
import parentChild from "@/assets/parent-child.jpg";

export const Route = createFileRoute("/ueber-uns")({
  head: () => ({ meta: [
    { title: "Über uns – Sicher Schwimmen e.V." },
    { name: "description", content: "Mission, Vision und Werte unseres Schwimmvereins in Hennef." },
  ]}),
  component: Page,
});

function Page() {
  return (
    <PublicLayout>
      <section className="bg-hero text-white py-20">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h1 className="font-display text-5xl md:text-6xl font-bold mb-4">Über uns</h1>
          <p className="text-white/85 text-lg">Sicher Schwimmen e.V. ist Ihr Schwimmverein in Hennef – mit Leidenschaft für sichere Schwimmausbildung und gelebte Gemeinschaft.</p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 grid lg:grid-cols-2 gap-12 items-center">
        <img src={parentChild} alt="" className="rounded-3xl shadow-card" width={1024} height={768} loading="lazy" />
        <div className="space-y-4">
          <div className="text-accent font-semibold uppercase tracking-wider text-sm">Unsere Mission</div>
          <h2 className="font-display text-4xl font-bold text-primary-deep">Schwimmen können rettet Leben</h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Wir setzen uns dafür ein, dass jedes Kind in Hennef und im
            Rhein-Sieg-Kreis sicher schwimmen lernen kann. Mit qualifizierten
            Übungsleiter*innen, kleinen Gruppen und einem klaren
            Kinderschutzkonzept legen wir die Grundlage für ein Leben am und im Wasser.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Target, title: "Mission", text: "Sichere Schwimmausbildung für alle – unabhängig von Alter und Hintergrund." },
            { icon: Eye, title: "Vision", text: "Eine Region, in der niemand am Wasser unsicher ist." },
            { icon: Heart, title: "Werte", text: "Sicherheit, Respekt, Familienorientierung und Inklusion." },
          ].map(b => (
            <Card key={b.title} className="border-0 shadow-soft">
              <CardContent className="p-7">
                <b.icon className="h-10 w-10 text-accent mb-3" />
                <h3 className="font-display font-bold text-xl text-primary-deep mb-2">{b.title}</h3>
                <p className="text-muted-foreground">{b.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-wave py-16">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-deep mb-8">Was uns wichtig ist</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Sparkles, label: "Schwimmausbildung" },
              { icon: Heart, label: "Wassersicherheit" },
              { icon: Users, label: "Jugendförderung" },
              { icon: Accessibility, label: "Inklusion" },
            ].map(i => (
              <div key={i.label} className="bg-card p-6 rounded-2xl shadow-soft">
                <i.icon className="h-8 w-8 text-primary mx-auto mb-2" />
                <div className="font-semibold text-primary-deep">{i.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {["Vorstand", "Trainer*innen", "Partnerorganisationen"].map((t) => (
            <Card key={t} className="border-0 shadow-soft">
              <CardContent className="p-8 text-center">
                <h3 className="font-display font-bold text-xl text-primary-deep mb-2">{t}</h3>
                <p className="text-sm text-muted-foreground">Inhalte folgen in Kürze.</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
