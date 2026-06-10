import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Eye, Heart, Users, Sparkles, Accessibility } from "lucide-react";
import parentChild from "@/assets/parent-child.jpg";
import sandraKratzAsset from "@/assets/sandra-kratz.png.asset.json";
import michaelKratzAsset from "@/assets/michael-kratz.jpg.asset.json";
import manuelaScholzOrnowskiAsset from "@/assets/manuela-scholz-ornowski.jpg.asset.json";

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
        <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-deep mb-8 text-center">Vorstand & Verein</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {[
            {
              role: "1. Vorsitzender",
              name: "Michael Kratz",
              photo: michaelKratzAsset.url,
              objectPosition: "center 20%",
              bio: "Michael Kratz verfügt über nahezu vier Jahrzehnte Erfahrung in der Schwimmausbildung und im Bäderwesen. Als staatlich geprüfte Fachkraft für Bäderbetriebe vermittelt er bereits seit seiner Jugend Kindern und Erwachsenen Sicherheit und Freude im Wasser. Sein beruflicher Werdegang umfasst unter anderem die Bereiche Schwimmausbildung, Badeaufsicht, Wasseraufbereitung und Gesundheitsförderung. Darüber hinaus engagiert er sich seit vielen Jahren in der Kinderbetreuung und betreibt gemeinsam mit seiner Frau Sandra die Großtagespflege „Hennefer Mäusenest“. Durch seine Kombination aus pädagogischer Erfahrung und fachlicher Expertise im Schwimmsport setzt er sich mit besonderem Engagement für die Förderung der Schwimmfähigkeit und die Prävention von Badeunfällen ein.",
            },
            {
              role: "2. Vorsitzende",
              name: "Sandra Kratz",
              photo: sandraKratzAsset.url,
              objectPosition: "center",
              bio: "Sandra Kratz engagiert sich seit vielen Jahren mit großer Leidenschaft für die Betreuung und Förderung von Kindern. Bereits 2008 begann sie ihre Tätigkeit als qualifizierte Kindertagespflegeperson und baute in Hennef ihre eigene Kindertagespflegestelle „Die kleinen Feldmäuse“ auf. Seitdem begleitet sie Kinder in ihren ersten Lebensjahren mit viel Herz, Fachwissen und pädagogischer Erfahrung. Dabei orientiert sie sich an den individuellen Bedürfnissen und Interessen jedes Kindes und verbindet bewährte pädagogische Ansätze mit einer alltagsnahen, liebevollen Betreuung. Regelmäßige Fort- und Weiterbildungen gehören für sie selbstverständlich zu ihrer professionellen Arbeit. Gemeinsam mit ihrem Mann Michael Kratz betreibt sie seit 2016 die Großtagespflege „Hennefer Mäusenest“. Ihre langjährige Erfahrung in der Arbeit mit Kindern und Familien bringt sie heute auch in die Vorstandsarbeit von Sicher Schwimmen ein.",
            },
            {
              role: "Kassenwart/Mitgliederverwaltung",
              name: "Manuela Scholz-Ornowski",
              photo: manuelaScholzOrnowskiAsset.url,
              bio: "Manuela Scholz-Ornowski engagiert sich im Vorstand von Sicher Schwimmen für die Förderung von Schwimmkompetenz und Wassersicherheit. Mit ihrem Einsatz unterstützt sie die Weiterentwicklung der Vereinsarbeit und setzt sich dafür ein, möglichst vielen Kindern und Familien den Zugang zu qualifizierter Schwimmausbildung zu ermöglichen. Ihr besonderes Anliegen ist es, Menschen für die Bedeutung von Schwimmfähigkeit als wichtige Lebenskompetenz zu sensibilisieren und die Ziele des Vereins nachhaltig voranzubringen.",
            },
          ].map((p) => (
            <Card key={p.role} className="border-0 shadow-soft h-full">
              <CardContent className="p-7">
                <div className="flex items-center gap-4 mb-4">
                  {p.photo ? (
                    <img
                      src={p.photo}
                      alt={p.name}
                      className="h-20 w-20 rounded-full object-cover shrink-0 ring-2 ring-accent/20"
                      style={{ objectPosition: p.objectPosition ?? "center" }}
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-muted shrink-0" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <div className="text-accent font-semibold uppercase tracking-wider text-xs mb-1">{p.role}</div>
                    <h3 className="font-display font-bold text-lg text-primary-deep leading-tight">{p.name}</h3>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">{p.bio}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-sm text-muted-foreground text-center max-w-2xl mx-auto">
          Der Verein befindet sich in Gründung. Vereinsregister-Nummer und Steuernummer werden nach
          Abschluss des Gründungsverfahrens ergänzt.
        </p>
      </section>

    </PublicLayout>
  );
}
