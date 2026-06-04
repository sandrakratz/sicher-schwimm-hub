import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Shield, Eye, Users, Camera, LifeBuoy, BadgePlus, HandHeart, UserCheck, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/sicherheit")({
  head: () => ({ meta: [
    { title: "Sicherheit & Kinderschutz – Sicher Schwimmen e.V." },
    { name: "description", content: "Unser Kinderschutzkonzept und unsere Sicherheitsstandards im Schwimmverein Hennef." },
  ]}),
  component: Page,
});

const items = [
  { icon: Shield, title: "Kinderschutz im Mittelpunkt", text: "Wir verpflichten uns einem umfassenden Kinderschutzkonzept – dokumentiert und gelebt." },
  { icon: UserCheck, title: "Erweiterte Führungszeugnisse", text: "Alle Übungsleiter*innen legen ein erweitertes Führungszeugnis vor." },
  { icon: BadgePlus, title: "Verhaltenskodex", text: "Verbindlicher Verhaltenskodex für alle Trainer*innen und Helfer*innen." },
  { icon: Eye, title: "Vier-Augen-Prinzip", text: "Keine Eins-zu-Eins-Situationen ohne Sichtbarkeit für Dritte." },
  { icon: Camera, title: "Foto-Richtlinie", text: "Keine Fotos oder Videos ohne ausdrückliche schriftliche Einwilligung." },
  { icon: LifeBuoy, title: "Rettungsschwimmer-Pflicht", text: "Trainer*innen besitzen aktuelle Rettungsschwimmer-Qualifikationen." },
  { icon: HandHeart, title: "Transparente Hilfestellung", text: "Körperliche Hilfestellung erfolgt nur transparent und altersgerecht." },
  { icon: Users, title: "Eltern-Kind Aufsicht", text: "Klare Regeln zur Aufsicht und Begleitung jüngerer Kinder." },
  { icon: Phone, title: "Vertrauensperson", text: "Eigene Kinderschutz-Ansprechperson – vertraulich erreichbar." },
];

function Page() {
  return (
    <PublicLayout>
      <section className="bg-hero text-white py-20">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <Shield className="h-14 w-14 text-accent mx-auto mb-4" />
          <h1 className="font-display text-5xl font-bold mb-3">Sicherheit & Kinderschutz</h1>
          <p className="text-white/85 text-lg">Der Schutz der uns anvertrauten Kinder hat höchste Priorität.</p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(i => (
            <Card key={i.title} className="border-0 shadow-soft hover:shadow-card transition-shadow">
              <CardContent className="p-7">
                <i.icon className="h-10 w-10 text-accent mb-3" />
                <h3 className="font-display font-bold text-lg text-primary-deep mb-2">{i.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{i.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
