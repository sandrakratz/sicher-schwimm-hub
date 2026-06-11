import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Users, Tag } from "lucide-react";

export const Route = createFileRoute("/kurse")({
  head: () => ({
    meta: [
      { title: "Schwimmkurse Hennef – Seepferdchen, Bronze, Silber & Gold | Sicher Schwimmen e.V." },
      { name: "description", content: "Alle Schwimmkurse in Hennef im Überblick: Wassergewöhnung, Anfängerschwimmen, Seepferdchen, Bronze, Silber, Gold sowie Ferien-Intensivkurse. Kleine Gruppen im Hallenbad Hennef." },
      { name: "keywords", content: "Schwimmkurs Hennef, Seepferdchen Kurs, Bronze Silber Gold, Wassergewöhnung Kinder, Ferienkurs Schwimmen Rhein-Sieg-Kreis" },
      { property: "og:title", content: "Schwimmkurse in Hennef – Übersicht" },
      { property: "og:description", content: "Vom ersten Plantschen bis zum Goldabzeichen – Schwimmkurse für Kinder, Familien und Erwachsene in Hennef." },
      { property: "og:url", content: "https://sicher-schwimmen.com/kurse" },
    ],
    links: [{ rel: "canonical", href: "https://sicher-schwimmen.com/kurse" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: courses.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Course",
            name: c.name,
            description: c.desc,
            provider: {
              "@type": "Organization",
              name: "Sicher Schwimmen e.V.",
              url: "https://sicher-schwimmen.com",
            },
          },
        })),
      }),
    }],
  }),
  component: KursePage,
});

type Status = "Offen" | "Warteliste" | "Ausgebucht";

const STANDARD_PRICE = "200 €";
const MEMBER_PRICE = "150 €";
const STANDARD_UNITS = "10 Einheiten à 45 Min.";

const courses: { name: string; group: string; age: string; desc: string; requirements: string; duration: string; location: string; status: Status; price?: { standard: string; member: string; units: string } | "tbd" }[] = [
  { name: "Wassergewöhnung", group: "Kinder", age: "3–5 Jahre", desc: "Spielerische erste Erfahrungen im Wasser ohne Leistungsdruck.", requirements: "Keine Voraussetzungen.", duration: "10 Wochen", location: "Hallenbad Hennef", status: "Warteliste", price: { standard: STANDARD_PRICE, member: MEMBER_PRICE, units: STANDARD_UNITS } },
  { name: "Eltern & Kind", group: "Familien", age: "1–3 Jahre", desc: "Gemeinsame Wasserzeit für Eltern mit Kleinkindern.", requirements: "Keine Voraussetzungen.", duration: "8 Wochen", location: "Hallenbad Hennef", status: "Warteliste", price: "tbd" },
  { name: "Anfänger Schwimmen", group: "Kinder", age: "ab 5", desc: "Erste Schwimmtechniken und Sicherheit im Wasser.", requirements: "Keine Angst vor Wasser, ggf. altersgerechte Motorik (Hampelmann, Laufrad-/Fahrradfahren).", duration: "12 Wochen", location: "Hallenbad Hennef", status: "Warteliste", price: { standard: STANDARD_PRICE, member: MEMBER_PRICE, units: STANDARD_UNITS } },
  { name: "Schwimmabzeichen Seepferdchen", group: "Kinder", age: "5–8", desc: "Gezielte Vorbereitung auf das Seepferdchen-Abzeichen.", requirements: "Kopf unter Wasser nehmen, Springen ins Wasser, Motorik Hampelmann.", duration: "10 Wochen", location: "Hallenbad Hennef", status: "Offen", price: { standard: STANDARD_PRICE, member: MEMBER_PRICE, units: STANDARD_UNITS } },
  { name: "Schwimmabzeichen Bronze", group: "Kinder/Jugend", age: "ab 7", desc: "Sicheres Schwimmen über längere Strecken.", requirements: "Bedingungen des Seepferdchen-Abzeichens müssen erfüllt sein.", duration: "10 Wochen", location: "Hallenbad Hennef", status: "Offen", price: { standard: STANDARD_PRICE, member: MEMBER_PRICE, units: STANDARD_UNITS } },
  { name: "Schwimmabzeichen Silber", group: "Kinder/Jugend", age: "ab 9", desc: "Erweiterte Technik und Ausdauer.", requirements: "Bedingungen des Bronze-Abzeichens müssen erfüllt sein.", duration: "10 Wochen", location: "Hallenbad Hennef", status: "Offen", price: { standard: STANDARD_PRICE, member: MEMBER_PRICE, units: STANDARD_UNITS } },
  { name: "Ferien-Intensivkurse", group: "Kinder", age: "5–10", desc: "Schnell ins Schwimmen kommen in den Ferien.", requirements: "Je nach Kursniveau – bitte bei Anfrage angeben.", duration: "5 Tage", location: "Hallenbad Hennef", status: "Warteliste", price: "tbd" },
];

function statusVariant(s: Status) {
  if (s === "Offen") return "bg-success/15 text-success border-success/30";
  if (s === "Warteliste") return "bg-warning/15 text-warning-foreground border-warning/30";
  return "bg-destructive/10 text-destructive border-destructive/30";
}

function KursePage() {
  return (
    <PublicLayout>
      <section className="bg-hero text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-display text-5xl md:text-6xl font-bold mb-4">Unsere Schwimmkurse</h1>
          <p className="text-white/85 text-lg max-w-2xl mx-auto">
            Vom ersten Plantschen bis zum Goldabzeichen – wir haben den richtigen
            Kurs für jedes Alter und jedes Niveau.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((c) => (
            <Card key={c.name} className="shadow-soft border-0 hover:shadow-card transition-shadow flex flex-col">
              <CardContent className="p-6 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline" className="bg-secondary text-primary-deep border-0">{c.group}</Badge>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${statusVariant(c.status)}`}>{c.status}</span>
                </div>
                <h3 className="font-display text-xl font-bold text-primary-deep mb-1">{c.name}</h3>
                <div className="text-sm font-semibold text-primary mb-3">{c.age}</div>
                <p className="text-sm text-muted-foreground mb-3">{c.desc}</p>
                <div className="text-xs mb-4 flex-1">
                  <span className="font-semibold text-primary-deep">Voraussetzungen: </span>
                  <span className="text-muted-foreground">{c.requirements}</span>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground border-t pt-4 mb-4">
                  <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />{c.duration}</div>
                  <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{c.location}</div>
                  <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5" />Kleine Gruppen</div>
                  {c.price && c.price !== "tbd" ? (
                    <div className="flex items-start gap-2 pt-1">
                      <Tag className="h-3.5 w-3.5 mt-0.5" />
                      <div>
                        <div><span className="font-semibold text-foreground">{c.price.standard}</span> Normalpreis · <span className="font-semibold text-primary">{c.price.member}</span> für Mitglieder</div>
                        <div className="text-[11px] opacity-80">{c.price.units} · Mitglieder werden bevorzugt aufgenommen</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 pt-1"><Tag className="h-3.5 w-3.5" />Preis folgt nach Schwimmbadbuchung</div>
                  )}
                </div>
                <Button asChild variant={c.status === "Ausgebucht" ? "outline" : "accent"} className="w-full">
                  <Link to="/kurs-anfragen">{c.status === "Ausgebucht" ? "Auf Warteliste" : "Anfragen"}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>


        <p className="text-center text-sm text-muted-foreground mt-10">
          Mit der Anmeldung gelten unsere{" "}
          <Link to="/kursbedingungen" className="text-primary underline font-semibold hover:text-primary-deep">
            Kursteilnahmebedingungen
          </Link>
          {" "}(Zahlung, Rücktritt, Aufsicht, Haftung).
        </p>
      </section>
    </PublicLayout>
  );
}
