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
  { icon: UserCheck, title: "Erweiterte Führungszeugnisse", text: "Alle Personen ab 16 Jahren mit regelmäßigem Kontakt zu Minderjährigen legen ein eFZ vor – mit Wiedervorlage in der Regel alle 3 bis 5 Jahre." },
  { icon: BadgePlus, title: "Verhaltenskodex", text: "Verbindlicher Verhaltenskodex (LSB NRW oder vereinsintern) für alle Trainer*innen und Helfer*innen." },
  { icon: Eye, title: "Vier-Augen-Prinzip", text: "Soweit organisatorisch umsetzbar bleibt keine Lehrkraft allein mit der Gruppe in nicht einsehbaren Bereichen." },
  { icon: Users, title: "Umkleidesituationen", text: "Übungsleiter*innen betreten die Sammelumkleiden nur im Ausnahmefall – nach lautem Anklopfen und Ankündigung." },
  { icon: Camera, title: "Foto- & Filmverbot", text: "Im Schwimm- und Umkleidebereich gilt striktes Fotografie- und Filmverbot ohne ausdrückliche schriftliche Einwilligung." },
  { icon: LifeBuoy, title: "Rettungsfähigkeit", text: "Für jede Gruppe im Wasser ist die Rettungsfähigkeit (DRSA Silber oder äquivalenter Nachweis) sichergestellt." },
  { icon: HandHeart, title: "Transparente Hilfestellung", text: "Körperkontakt wird auf das sportlich notwendige Maß beschränkt und den Kindern vorab angekündigt." },
  { icon: Phone, title: "Vertrauensperson Kinderschutz", text: "Sandra Kratz – vertraulich erreichbar unter info@sicher-schwimmen.com." },
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
