import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { AiImageNotice } from "@/components/AiImageNotice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Users, Tag } from "lucide-react";
import { CancellationButton } from "@/components/CancellationButton";
import { BILLING } from "@/lib/billing-config";
import { BankDetails } from "@/components/BankDetails";
import { formatPrice } from "@/lib/format";
import { programStatus } from "@/lib/course-status";
import { listCoursePrograms, type CourseProgram } from "@/lib/courses-public.functions";
import { HIDDEN_PROGRAM_SLUGS, NOT_BOOKABLE_NOTE, UPCOMING_PROGRAMS } from "@/lib/upcoming-programs";

export const Route = createFileRoute("/kurse")({
  loader: async () => await listCoursePrograms(),
  head: ({ loaderData }) => ({
    meta: [
      { title: "Schwimmkurse Hennef – Seepferdchen, Bronze, Silber & Gold | Sicher Schwimmen e.V." },
      { name: "description", content: "Alle Schwimmkurse in Hennef im Überblick: Wassergewöhnung, Anfängerschwimmen, Seepferdchen, Bronze, Silber, Gold sowie Ferien-Intensivkurse. Kleine Gruppen im Rhein-Sieg-Kreis." },
      { name: "keywords", content: "Schwimmkurs Hennef, Seepferdchen Kurs, Bronze Silber Gold, Wassergewöhnung Kinder, Ferienkurs Schwimmen Rhein-Sieg-Kreis" },
      { property: "og:title", content: "Schwimmkurse in Hennef – Übersicht" },
      { property: "og:description", content: "Vom ersten Plantschen bis zum Goldabzeichen – Schwimmkurse für Kinder, Familien und Erwachsene in Hennef." },
      { property: "og:url", content: "https://sicher-schwimmen.com/kurse" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://sicher-schwimmen.com/kurse" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: ((loaderData ?? []) as Array<CourseProgram>).filter((c) => !HIDDEN_PROGRAM_SLUGS.includes(c.slug)).map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Course",
            name: c.name,
            description: c.description ?? undefined,
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

function KursePage() {
  const programs = ((Route.useLoaderData() ?? []) as Array<CourseProgram>).filter(
    (p) => !HIDDEN_PROGRAM_SLUGS.includes(p.slug),
  );

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
        <div className="mb-8 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-primary-deep">
          <strong>Hinweis:</strong> Wir befinden uns derzeit in der finalen Abstimmung der Wasserzeiten mit mehreren Schwimmbädern. Daher wird der genaue Kursort jedem Kurs nach der endgültigen Beckenvergabe zugeordnet und allen Teilnehmenden rechtzeitig bzw. bei Kursbestätigung mitgeteilt.
        </div>

        {programs.length === 0 ? (
          <p className="text-center text-muted-foreground">Aktuell sind keine Kursangebote veröffentlicht.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs.map((c) => {
              const openTerms = c.open_terms ?? 0;
              const hasTerms = (c.terms?.length ?? 0) > 0;
              const { label: statusLabel, className: statusClass } = programStatus(openTerms, hasTerms);
              const std = formatPrice(c.price_non_member);
              const mem = formatPrice(c.price_member);
              return (
                <Card key={c.id} className="shadow-soft border-0 hover:shadow-card transition-shadow flex flex-col">
                  <CardContent className="p-6 flex flex-col flex-1">
                    <div className="flex items-center justify-between mb-3 gap-2">
                      {c.target_group && (
                        <Badge variant="outline" className="bg-secondary text-primary-deep border-0 line-clamp-1">{c.target_group}</Badge>
                      )}
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold whitespace-nowrap ${statusClass}`}>{statusLabel}</span>
                    </div>
                    <h3 className="font-display text-xl font-bold text-primary-deep mb-1">{c.name}</h3>
                    {c.age_range && <div className="text-sm font-semibold text-primary mb-3">{c.age_range}</div>}
                    {c.description && <p className="text-sm text-muted-foreground mb-3">{c.description}</p>}
                    {c.requirements && (
                      <div className="text-xs mb-4 flex-1">
                        <span className="font-semibold text-primary-deep">Voraussetzungen: </span>
                        <span className="text-muted-foreground">{c.requirements}</span>
                      </div>
                    )}
                    <div className="space-y-1.5 text-xs text-muted-foreground border-t pt-4 mb-4">
                      {c.duration && <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />{c.duration}</div>}
                      {c.location && <div className="flex items-start gap-2"><MapPin className="h-3.5 w-3.5 mt-0.5" />{c.location}</div>}
                      <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5" />Kleine Gruppen</div>
                      {std || mem ? (
                        <div className="flex items-start gap-2 pt-1">
                          <Tag className="h-3.5 w-3.5 mt-0.5" />
                          <div>
                            <div>
                              {std && <><span className="font-semibold text-foreground">{std}</span> Normalpreis</>}
                              {std && mem && " · "}
                              {mem && <><span className="font-semibold text-primary">{mem}</span> für Mitglieder</>}
                            </div>
                            <div className="text-[11px] opacity-80">Mitglieder werden bevorzugt aufgenommen</div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 pt-1"><Tag className="h-3.5 w-3.5" />Preis folgt nach Schwimmbadbuchung</div>
                      )}
                    </div>
                    <Button asChild variant={openTerms > 0 ? "accent" : "outline"} className="w-full">
                      <Link to="/kurse/$slug" params={{ slug: c.slug }}>
                        {openTerms > 0 ? "Termine ansehen & buchen" : hasTerms ? "Termine ansehen" : "Details & Anfrage"}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-12 max-w-2xl mx-auto rounded-2xl border bg-card p-6 shadow-soft">
          <h2 className="font-display text-xl font-bold text-primary-deep mb-2">Zahlung &amp; Bankverbindung</h2>
          <p className="text-sm text-muted-foreground mb-4">{BILLING.dueNote}</p>
          <BankDetails />
        </div>

        <p className="text-center text-sm text-muted-foreground mt-10">
          Mit der Anmeldung gelten unsere{" "}
          <Link to="/kursbedingungen" className="text-primary underline font-semibold hover:text-primary-deep">
            Kursteilnahmebedingungen
          </Link>
          {" "}(Zahlung, Rücktritt, Aufsicht, Haftung).
        </p>
        <div className="flex justify-center mt-6">
          <CancellationButton />
        </div>
        <AiImageNotice className="mt-8 text-center" />
      </section>
    </PublicLayout>
  );
}
