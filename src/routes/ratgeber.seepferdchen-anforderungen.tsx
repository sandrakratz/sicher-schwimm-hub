import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, Waves, Timer, LifeBuoy } from "lucide-react";
import { COURSE_LOCATION } from "@/lib/billing-config";

const REQUIREMENTS = [
  {
    title: "Sprung vom Beckenrand ins Wasser",
    text: "Das Kind springt selbstständig kopfüber oder mit den Füßen zuerst vom Beckenrand ins tiefere Wasser und taucht danach wieder auf.",
  },
  {
    title: "25 Meter Schwimmen",
    text: "Direkt nach dem Sprung schwimmt das Kind 25 Meter in Bauch- oder Rückenlage ohne Pause und ohne Hilfsmittel. Der Schwimmstil ist frei wählbar, muss aber erkennbar und gleichmäßig sein.",
  },
  {
    title: "Gegenstand heraufholen",
    text: "Aus schultertiefem Wasser holt das Kind mit den Händen einen Tauchring oder ähnlichen Gegenstand vom Beckenboden herauf.",
  },
  {
    title: "Baderegeln kennen",
    text: "Das Kind kennt die wichtigsten Baderegeln und kann sie in eigenen Worten erklären – zum Beispiel: nie alleine schwimmen, nicht erhitzt ins Wasser springen, nur dort baden, wo es erlaubt ist.",
  },
];

const FAQS = [
  {
    q: "Ab welchem Alter ist das Seepferdchen sinnvoll?",
    a: "In der Regel ab etwa 5 Jahren. Entscheidend ist weniger das Alter als die Wassergewöhnung: Wer sich im Wasser wohlfühlt, den Kopf untertaucht und ausatmen kann, lernt das Seepferdchen deutlich schneller.",
  },
  {
    q: "Wie lange dauert es bis zum Seepferdchen?",
    a: "Die meisten Kinder brauchen einen bis zwei Kurse mit je 10 Einheiten. Kinder, die vorher schon Wassergewöhnung hatten, sind oft schneller. Regelmäßiges Üben zwischendurch im Familienbad hilft sehr.",
  },
  {
    q: "Ist das Seepferdchen ein Freischwimmer?",
    a: "Nein. Das Seepferdchen ist ein Frühschwimmer-Abzeichen und zeigt, dass ein Kind erste Schwimmzüge sicher beherrscht. Sicher schwimmen kann ein Kind erst ab dem Bronze-Abzeichen – bis dahin gehört es immer in Sicht- und Reichweite eines Erwachsenen.",
  },
  {
    q: "Was kommt nach dem Seepferdchen?",
    a: "Das Deutsche Schwimmabzeichen in Bronze, danach Silber und Gold. Bronze verlangt unter anderem 15 Minuten Dauerschwimmen und einen Sprung vom Startblock oder Ein-Meter-Brett.",
  },
];

export const Route = createFileRoute("/ratgeber/seepferdchen-anforderungen")({
  head: () => ({
    meta: [
      { title: "Seepferdchen Anforderungen: Das muss Ihr Kind können | Sicher Schwimmen e.V." },
      {
        name: "description",
        content:
          "Seepferdchen-Anforderungen im Überblick: Sprung vom Beckenrand, 25 Meter Schwimmen, Gegenstand heraufholen und Baderegeln. Plus Tipps zum Üben und wie lange es dauert.",
      },
      { property: "og:title", content: "Seepferdchen Anforderungen: Das muss Ihr Kind können" },
      {
        property: "og:description",
        content:
          "Alle vier Prüfungsteile des Seepferdchens verständlich erklärt – mit Tipps zur Vorbereitung und dem Weg zum nächsten Abzeichen.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://sicher-schwimmen.com/ratgeber/seepferdchen-anforderungen" },
    ],
    links: [
      { rel: "canonical", href: "https://sicher-schwimmen.com/ratgeber/seepferdchen-anforderungen" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Seepferdchen Anforderungen: Das muss Ihr Kind können",
          inLanguage: "de-DE",
          about: "Seepferdchen Schwimmabzeichen",
          author: { "@type": "SportsClub", name: "Sicher Schwimmen e.V." },
          publisher: {
            "@type": "SportsClub",
            name: "Sicher Schwimmen e.V.",
            url: "https://sicher-schwimmen.com",
          },
          mainEntityOfPage: "https://sicher-schwimmen.com/ratgeber/seepferdchen-anforderungen",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Startseite", item: "https://sicher-schwimmen.com/" },
            {
              "@type": "ListItem",
              position: 2,
              name: "Seepferdchen Anforderungen",
              item: "https://sicher-schwimmen.com/ratgeber/seepferdchen-anforderungen",
            },
          ],
        }),
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <PublicLayout>
      <section className="bg-hero text-white py-20">
        <div className="container mx-auto px-4 max-w-3xl text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-4 py-1.5 text-sm font-semibold">
            <Waves className="h-4 w-4 text-accent" /> Ratgeber
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold">Seepferdchen: Diese Anforderungen muss Ihr Kind erfüllen</h1>
          <p className="text-white/85 text-lg">
            Das Seepferdchen ist das erste Schwimmabzeichen und besteht aus vier Prüfungsteilen. Hier erfahren Sie,
            was Ihr Kind können muss, wie lange die Vorbereitung dauert und wie Sie zu Hause üben können.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 max-w-3xl space-y-10">
        <div className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-primary-deep">Die vier Prüfungsteile</h2>
          <div className="grid gap-4">
            {REQUIREMENTS.map((r) => (
              <Card key={r.title} className="shadow-soft">
                <CardContent className="p-6 flex gap-4">
                  <CheckCircle2 className="h-6 w-6 text-accent shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <h3 className="font-display font-bold text-primary-deep mb-1">{r.title}</h3>
                    <p className="text-muted-foreground">{r.text}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Alle vier Teile werden in einer Prüfung abgenommen. Erst danach erhält das Kind Abzeichen und Urkunde.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-primary-deep flex items-center gap-2">
            <Timer className="h-5 w-5 text-accent" aria-hidden="true" /> So bereiten Sie Ihr Kind vor
          </h2>
          <ul className="space-y-2 text-muted-foreground list-disc pl-5">
            <li>Regelmäßig ins Wasser: Lieber einmal pro Woche kurz als selten und lang.</li>
            <li>Kopf unter Wasser und ins Wasser ausatmen üben – das ist die Grundlage für alles Weitere.</li>
            <li>Gleiten üben: vom Beckenrand abstoßen und sich lang machen, ohne zu paddeln.</li>
            <li>Springen vom Beckenrand spielerisch üben, damit der Sprung in der Prüfung keine Hürde ist.</li>
            <li>Tauchringe holen macht Spaß und trainiert genau die geforderte Übung.</li>
            <li>Die Baderegeln zu Hause gemeinsam durchgehen und erklären lassen.</li>
          </ul>
          <p className="text-muted-foreground">
            Mehr zum sicheren Verhalten am und im Wasser finden Sie auf unserer{" "}
            <Link to="/sicherheit" className="text-primary-deep underline underline-offset-4">
              Seite zur Sicherheit und zu den Baderegeln
            </Link>
            .
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-primary-deep flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-accent" aria-hidden="true" /> Häufige Fragen zum Seepferdchen
          </h2>
          <div className="space-y-4">
            {FAQS.map((f) => (
              <div key={f.q}>
                <h3 className="font-semibold text-primary-deep">{f.q}</h3>
                <p className="text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </div>

        <Card className="bg-muted/40 shadow-soft">
          <CardContent className="p-8 text-center space-y-4">
            <h2 className="font-display text-2xl font-bold text-primary-deep">Seepferdchen-Kurs in Hennef</h2>
            <p className="text-muted-foreground">
              In unseren Kursen im {COURSE_LOCATION} lernen Kinder in kleinen Gruppen genau diese vier Übungen –
              Schritt für Schritt und ohne Druck.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button asChild size="lg">
                <Link to="/kurse">
                  Kurse ansehen <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/warteliste">Platz auf der Warteliste sichern</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </PublicLayout>
  );
}
