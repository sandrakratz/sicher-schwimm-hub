import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Shield,
  Users,
  Heart,
  Waves,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  MapPin,
} from "lucide-react";
import heroPool from "@/assets/hero-pool.jpg";
import kids from "@/assets/kids-swimming.jpg";
import beaverAsset from "@/assets/sw-logo.png.asset.json";
const beaver = beaverAsset.url;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sicher Schwimmen lernen in Hennef – Sicher Schwimmen e.V." },
      { name: "description", content: "Schwimmkurse, Wassergewöhnung und Schwimmaktivitäten für Kinder, Familien und Erwachsene in Hennef und im Rhein-Sieg-Kreis." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-hero text-white">
        <img
          src={heroPool}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-25"
          width={1920}
          height={1280}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary-deep/60 via-primary-deep/40 to-primary-deep/80" />
        <div className="relative container mx-auto px-4 py-24 md:py-32 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-4 py-1.5 text-sm font-semibold">
              <Waves className="h-4 w-4 text-accent" /> Schwimmverein in Hennef · Rhein-Sieg-Kreis
            </div>
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] text-balance">
              Sicher Schwimmen lernen in&nbsp;<span className="text-accent">Hennef</span>
            </h1>
            <p className="text-lg md:text-xl text-white/85 max-w-2xl leading-relaxed text-balance">
              Sicher Schwimmen e.V. bietet Schwimmkurse, Wassergewöhnung und
              Vereinsaktivitäten für Kinder, Familien und Erwachsene im
              Rhein-Sieg-Kreis – mit Herz, Geduld und höchsten
              Sicherheitsstandards.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="accent" size="xl">
                <Link to="/kurs-anfragen">Auf Warteliste setzen <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="hero" size="xl">
                <Link to="/kurse">Kurse ansehen</Link>
              </Button>
              <Button asChild variant="heroOutline" size="xl">
                <Link to="/mitgliedschaft">Mitglied werden</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-4 text-sm text-white/85">
              {[
                "Qualifizierte Übungsleiter",
                "Kinderschutzkonzept",
                "Kleine Gruppen",
                "Sicherheitsfokus",
                "Lokaler Verein",
              ].map((t) => (
                <span key={t} className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-accent" />{t}</span>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 relative hidden lg:block">
            <div className="absolute -inset-4 bg-accent/20 rounded-3xl blur-3xl" />
            <img
              src={beaver}
              alt="Maskottchen Sicher Schwimmen"
              className="relative w-full max-w-md mx-auto drop-shadow-2xl"
              width={512}
              height={512}
            />
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-accent font-semibold uppercase tracking-wider text-sm mb-3">Warum wir?</div>
          <h2 className="text-4xl md:text-5xl font-bold text-primary-deep">Schwimmen lernen mit Herz</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Wir verbinden professionelle Schwimmausbildung mit familiärer
            Atmosphäre und höchstem Anspruch an Sicherheit.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Shield, title: "Sicherheit zuerst", text: "Geschultes Personal mit Rettungsschwimmer- und Erste-Hilfe-Qualifikation, klares Vier-Augen-Prinzip." },
            { icon: Users, title: "Kleine Gruppen", text: "Individuelle Förderung in kleinen Lerngruppen – jedes Kind wird gesehen." },
            { icon: Heart, title: "Familienorientiert", text: "Vom Säuglingsschwimmen bis zur Familienkarte – wir begleiten alle Altersgruppen." },
          ].map((f) => (
            <Card key={f.title} className="shadow-card border-0 bg-card hover:-translate-y-1 transition-transform">
              <CardContent className="p-8">
                <div className="h-14 w-14 rounded-2xl bg-secondary text-primary flex items-center justify-center mb-5">
                  <f.icon className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-primary-deep mb-2">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Featured courses */}
      <section className="bg-wave py-20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-10">
            <div>
              <div className="text-accent font-semibold uppercase tracking-wider text-sm mb-3">Unsere Kurse</div>
              <h2 className="text-4xl md:text-5xl font-bold text-primary-deep">Für jedes Alter passend</h2>
            </div>
            <Button asChild variant="outline">
              <Link to="/kurse">Alle Kurse ansehen <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Waves, title: "Wassergewöhnung", age: "ab 3 Jahre", desc: "Spielerische erste Erfahrungen im Wasser." },
              { icon: Heart, title: "Eltern & Kind", age: "1–3 Jahre", desc: "Gemeinsame Wasserzeit für die Kleinsten." },
              { icon: GraduationCap, title: "Seepferdchen", age: "ab 5 Jahre", desc: "Vom Anfänger zum ersten Schwimmabzeichen." },
              { icon: Sparkles, title: "Bronze / Silber / Gold", age: "Fortgeschrittene", desc: "Weiterführende Schwimmabzeichen." },
            ].map((c) => (
              <Card key={c.title} className="shadow-soft border-0 hover:shadow-card transition-shadow">
                <CardContent className="p-6">
                  <c.icon className="h-10 w-10 text-accent mb-4" />
                  <h3 className="font-bold text-lg text-primary-deep">{c.title}</h3>
                  <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">{c.age}</div>
                  <p className="text-sm text-muted-foreground">{c.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Safety section */}
      <section className="container mx-auto px-4 py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div className="relative">
          <img src={kids} alt="Kinder im Schwimmkurs" className="rounded-3xl shadow-card" width={1280} height={896} loading="lazy" />
          <div className="absolute -bottom-6 -right-6 bg-accent text-accent-foreground rounded-2xl p-5 shadow-glow hidden md:block">
            <div className="font-display font-bold text-3xl">100%</div>
            <div className="text-xs font-semibold">Kinderschutzkonzept</div>
          </div>
        </div>
        <div>
          <div className="text-accent font-semibold uppercase tracking-wider text-sm mb-3">Sicherheit & Schutz</div>
          <h2 className="text-4xl md:text-5xl font-bold text-primary-deep mb-6">Vertrauen ist unsere Grundlage</h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-6">
            Unsere Übungsleiter*innen verfügen über erweiterte Führungszeugnisse,
            Rettungsschwimmer-Qualifikation und werden regelmäßig zum
            Kinderschutz geschult. Klare Verhaltensregeln und das
            Vier-Augen-Prinzip sind für uns selbstverständlich.
          </p>
          <ul className="space-y-3 mb-8">
            {["Erweitertes Führungszeugnis aller Trainer*innen", "Rettungsschwimmer- und Erste-Hilfe-Pflicht", "Vier-Augen-Prinzip & klares Verhaltensregelwerk", "Fotografie-/Filmverbot ohne ausdrückliche Einwilligung"].map(i => (
              <li key={i} className="flex gap-3"><CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" /><span>{i}</span></li>
            ))}
          </ul>
          <Button asChild variant="default" size="lg">
            <Link to="/sicherheit">Mehr zum Kinderschutz</Link>
          </Button>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 pb-20">
        <div className="bg-hero rounded-3xl p-10 md:p-16 text-white text-center shadow-card relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-64 h-64 bg-accent/20 rounded-full blur-3xl" />
          <Waves className="h-12 w-12 mx-auto text-accent mb-4 relative" />
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-4 relative text-balance">
            Bereit, sicher schwimmen zu lernen?
          </h2>
          <p className="text-white/85 text-lg max-w-2xl mx-auto mb-8 relative">
            Setzen Sie Ihr Kind auf die Warteliste oder werden Sie Mitglied im Verein.
          </p>
          <div className="flex flex-wrap gap-3 justify-center relative">
            <Button asChild variant="accent" size="xl"><Link to="/kurs-anfragen">Auf Warteliste setzen</Link></Button>
            <Button asChild variant="heroOutline" size="xl"><Link to="/kontakt"><MapPin className="mr-1 h-4 w-4" />Kontakt aufnehmen</Link></Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
