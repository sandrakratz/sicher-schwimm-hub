import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { AiImageNotice } from "@/components/AiImageNotice";
import { SocialLinks } from "@/components/SocialLinks";
import { SOCIAL } from "@/lib/billing-config";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Eye, Heart, Users, Sparkles, Accessibility, ShieldCheck } from "lucide-react";
import parentChild from "@/assets/parent-child.jpg";
import sandraKratzAsset from "@/assets/sandra-kratz.png.asset.json";
import michaelKratzAsset from "@/assets/michael-kratz.jpg.asset.json";
import manuelaScholzOrnowskiAsset from "@/assets/manuela-scholz-ornowski.jpg.asset.json";


export const Route = createFileRoute("/ueber-uns")({
  head: () => ({
    meta: [
      { title: "Über uns – Schwimmverein in Hennef | Sicher Schwimmen e.V." },
      { name: "description", content: "Sicher Schwimmen e.V. – Schwimmverein in Hennef (Rhein-Sieg-Kreis). Lernen Sie unseren Vorstand, unsere Mission, Vision und Werte kennen." },
      { property: "og:title", content: "Über uns – Sicher Schwimmen e.V." },
      { property: "og:description", content: "Schwimmverein in Hennef mit Leidenschaft für sichere Schwimmausbildung und gelebte Gemeinschaft." },
      { property: "og:url", content: "https://sicher-schwimmen.com/ueber-uns" },
    ],
    links: [{ rel: "canonical", href: "https://sicher-schwimmen.com/ueber-uns" }],
  }),
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
        <div>
          <img src={parentChild} alt="" className="rounded-3xl shadow-card" width={1024} height={768} loading="lazy" />
          <AiImageNotice className="mt-4" />
        </div>

        <div className="space-y-4">
          <div className="text-accent font-semibold uppercase tracking-wider text-sm">Unsere Mission</div>
          <h2 className="font-display text-4xl font-bold text-primary-deep">Warum gibt es Sicher Schwimmen?</h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Wir setzen uns dafür ein, dass jedes Kind in Hennef und im
            Rhein-Sieg-Kreis sicher schwimmen lernen kann. Mit qualifizierten
            Übungsleiter*innen, kleinen Gruppen und einem klaren
            Kinderschutzkonzept legen wir die Grundlage für ein Leben am und im Wasser.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Schwimmen lernen ist mehr als Technik. Kinder brauchen Sicherheit,
            Vertrauen, Geduld – und Menschen, die verstehen, wie Kinder lernen und
            sich entwickeln. Nicht jedes Kind lernt gleich: Manche springen sofort
            ins Wasser, andere brauchen Zeit. Für uns ist das völlig in Ordnung. Wir
            holen Kinder dort ab, wo sie gerade stehen, und begleiten sie Schritt für
            Schritt auf ihrem eigenen Weg im Wasser.
          </p>
          <p className="font-semibold text-primary-deep leading-relaxed">
            Sicherheit kommt vor Leistung. Vertrauen kommt vor Tempo. Freude am
            Wasser ist wichtiger als ein schneller Erfolg.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-16">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-deep mb-8 text-center">Was uns wichtig ist</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: ShieldCheck, title: "Sicherheit", text: "Schwimmen lernen soll Kindern Sicherheit geben – im Wasser und im Umgang mit den eigenen Fähigkeiten." },
            { icon: Heart, title: "Vertrauen", text: "Jedes Kind hat sein eigenes Tempo. Wir begleiten Kinder, statt sie unter Druck zu setzen." },
            { icon: Sparkles, title: "Freude", text: "Schwimmenlernen darf Spaß machen. Freude am Wasser schafft Vertrauen und motiviert zum Weiterlernen." },
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
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-deep mb-6 text-center">Ein Verein mit Herz</h2>
          <p className="font-display text-2xl md:text-3xl font-bold text-primary-deep text-center leading-snug border-l-4 border-accent pl-5 md:pl-6 mb-8 text-balance">
            Bei uns steht nicht der wirtschaftliche Erfolg im Mittelpunkt, sondern das Kind.
          </p>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              Sicher Schwimmen e.V. ist ein gemeinnütziger Verein. Bei uns stehen
              die Kinder im Mittelpunkt: Wir möchten ihnen Sicherheit geben, ihnen
              Zeit lassen, Vertrauen aufbauen und sie auf ihrem ganz eigenen Weg
              begleiten.
            </p>
            <p>
              Viele Menschen bei Sicher Schwimmen engagieren sich ehrenamtlich. Sie
              bringen ihre Zeit, ihre Erfahrung und ihre Begeisterung für das
              Schwimmen und die Arbeit mit Kindern ein. Auch unsere nächste
              Generation wächst behutsam in ihre Aufgaben hinein: Sie darf zuschauen,
              ausprobieren, helfen und mit der Zeit Verantwortung übernehmen. Das ist
              für uns gelebtes Vereinsleben.
            </p>
            <p>
              Wir möchten einen Verein, in dem Kinder sich wohlfühlen, Menschen sich
              einbringen können und Gemeinschaft wirklich gelebt wird. Deshalb geht es
              uns nicht um ein möglichst großes Angebot um jeden Preis, sondern um
              persönliche Verantwortung für jedes Kind, das uns anvertraut wird.
            </p>
            <p className="font-semibold text-primary-deep">
              Sicher Schwimmen e.V. – ein Verein mit Herz.
            </p>
          </div>
        </div>
      </section>


      <section className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-deep mb-8">Was uns verbindet</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 mb-10">
            {[
              { icon: Sparkles, label: "Schwimmausbildung" },
              { icon: Heart, label: "Wassersicherheit" },
              { icon: Users, label: "Jugendförderung" },
              { icon: Accessibility, label: "Inklusion" },
            ].map(i => (
              <div key={i.label} className="bg-card p-5 sm:p-6 rounded-2xl shadow-soft overflow-hidden">
                <i.icon className="h-8 w-8 text-primary mx-auto mb-2" />
                <div lang="de" className="font-semibold text-primary-deep break-words hyphens-auto">{i.label}</div>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Die Verbindung aus Erfahrung im Schwimmbereich, pädagogischer Kompetenz
            und langjähriger Arbeit mit Kindern bildet die Grundlage unserer Arbeit.
          </p>
        </div>

        <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-deep mt-14 mb-3 text-center">Der Vorstand</h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-8">
          Sicher Schwimmen e.V. wird von einem gewählten Vorstand getragen, der
          Verantwortung für den Verein und seine Arbeit übernimmt.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              role: "1. Vorsitzender · Fachkraft für Bäderbetriebe",
              name: "Michael Kratz",
              photo: michaelKratzAsset.url,
              objectPosition: "center 20%",
              bio: "Ausgebildete Fachkraft für Bäderbetriebe mit langjähriger Erfahrung im Bäderwesen, in der Arbeit mit Kindern sowie in Schwimmausbildung und Wassergewöhnung.",
            },
            {
              role: "2. Vorsitzende · Kindertagespflegeperson & Fachkraft für Kleinkindpädagogik",
              name: "Sandra Kratz",
              photo: sandraKratzAsset.url,
              objectPosition: "center",
              bio: "Kindertagespflegeperson und Fachkraft für Kleinkindpädagogik mit langjähriger Erfahrung in der Arbeit mit Kindern und in der Schwimmausbildung.",
            },
            {
              role: "Kassenwartin",
              name: "Manuela Scholz-Ornowski",
              photo: manuelaScholzOrnowskiAsset.url,
              objectPosition: "center",
              bio: "Engagiert sich im Vorstand für die Förderung von Schwimmkompetenz und Wassersicherheit und dafür, möglichst vielen Kindern und Familien den Zugang zu qualifizierter Schwimmausbildung zu ermöglichen.",
            },

          ].map((p) => (
            <Card key={p.role} className="border-0 shadow-soft h-full min-w-0 overflow-hidden">
              <CardContent className="p-6 sm:p-7 min-w-0">
                <div className="flex items-center gap-4 mb-4 min-w-0">
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
                    <div lang="de" className="text-accent font-semibold uppercase tracking-wider text-xs mb-1 break-words hyphens-auto">{p.role}</div>
                    <h3 lang="de" className="font-display font-bold text-lg text-primary-deep leading-tight break-words">{p.name}</h3>
                  </div>
                </div>
                <p lang="de" className="text-muted-foreground text-sm leading-relaxed break-words hyphens-auto">{p.bio}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-sm text-muted-foreground text-center max-w-2xl mx-auto mt-8">
          Sicher Schwimmen e.V. ist im Vereinsregister beim Amtsgericht Siegburg unter der
          Register-Nr. VR 4149 eingetragen.
        </p>
      </section>

      <section className="bg-wave py-16">
        <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-8">
          <Card className="border-0 shadow-soft h-full">
            <CardContent className="p-7 space-y-4">
              <Users className="h-9 w-9 text-accent" />
              <h2 className="font-display text-2xl font-bold text-primary-deep">Unser Trainerteam</h2>
              <p className="text-muted-foreground leading-relaxed">
                Hinter unseren Schwimmkursen steht ein engagiertes Team aus
                Trainerinnen, Trainern und Nachwuchskräften.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Die Menschen dahinter sind so unterschiedlich wie die Kinder, die wir
                begleiten. Genau darin liegt eine unserer Stärken.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Unsere Trainerinnen und Trainer stellen sich auf Facebook und Instagram
                persönlich vor.
              </p>

              <SocialLinks className="text-primary-deep" />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-soft h-full">
            <CardContent className="p-7 space-y-4">
              <Sparkles className="h-9 w-9 text-accent" />
              <h2 className="font-display text-2xl font-bold text-primary-deep">Gemeinsam wachsen</h2>
              <p className="text-muted-foreground leading-relaxed">
                Wir freuen uns, wenn junge Menschen bei uns nicht nur schwimmen
                lernen, sondern irgendwann selbst Verantwortung übernehmen möchten.
                Wer bei uns mitwächst, darf beobachten, ausprobieren, helfen und
                Schritt für Schritt eigene Erfahrungen sammeln.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                So entsteht Nachwuchs nicht auf einmal, sondern ganz selbstverständlich
                über viele Jahre. Dabei muss niemand heute schon wissen, was er morgen
                einmal machen möchte.
              </p>
              <p className="font-semibold text-primary-deep">Gemeinsam wachsen – Schritt für Schritt.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto space-y-4">
          <ShieldCheck className="h-10 w-10 text-accent" />
          <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-deep">Kinderschutz endet nicht am Beckenrand</h2>
          <p className="text-muted-foreground leading-relaxed">
            Für uns gehört zum Schutz von Kindern nicht nur die Sicherheit im Wasser.
            Auch die Privatsphäre der Kinder ist uns wichtig. Deshalb veröffentlichen
            wir grundsätzlich keine identifizierbaren Fotos unserer Schwimmkinder.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Wir möchten unseren Verein trotzdem sichtbar und lebendig zeigen. Deshalb
            verwenden wir für unsere Website und unsere Social-Media-Kanäle
            Illustrationen und KI-generierte Motive. So können wir zeigen, wer wir
            sind und was uns wichtig ist, ohne dafür die Kinder ins Internet stellen
            zu müssen.
          </p>
          <p className="font-semibold text-primary-deep">Kinderschutz endet für uns nicht am Beckenrand.</p>
          <p className="text-sm text-muted-foreground">
            Mehr dazu in unserem{" "}
            <Link to="/sicherheit" className="underline">Kinderschutzkonzept</Link>.
          </p>
        </div>
      </section>

      <section className="bg-wave py-16">
        <div className="container mx-auto px-4 max-w-3xl text-center space-y-4">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-deep">Noch mehr von uns</h2>
          <p className="text-muted-foreground leading-relaxed">
            Unsere Website zeigt euch, wer wir sind und wofür Sicher Schwimmen steht.
            Auf Facebook und Instagram stellen wir unser Trainerteam vor, geben
            Einblicke in unser Vereinsleben und informieren über aktuelle Themen rund
            um Sicher Schwimmen. Wenn ihr wissen möchtet, wer hinter den einzelnen
            Gesichtern steckt, schaut gerne vorbei.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-primary-deep">
            <SocialLinks />
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
              {SOCIAL.map((s, idx) => (
                <span key={s.key} className="flex items-center gap-2">
                  {idx > 0 && <span aria-hidden="true" className="text-muted-foreground">|</span>}
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">{s.label}</a>
                </span>
              ))}
            </div>
          </div>
          <p className="font-display font-bold text-primary-deep pt-2">
            Sicher Schwimmen e.V. – Gemeinsam sicher ans Ziel.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}

