import { Link } from "@tanstack/react-router";
import { Clock, MapPin, Tag, Users } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDuration, formatPrice } from "@/lib/format";
import { LABELS } from "@/lib/labels";
import { NOT_BOOKABLE_NOTE, parseRequirementLines } from "@/lib/upcoming-programs";
import type { CourseProgram } from "@/lib/courses-public.functions";
import { splitParagraphs } from "./course-page-helpers";

/** Geplantes, noch nicht buchbares Angebot: nur Infos und Warteliste. */
export function UpcomingProgramPage({ up }: { up: CourseProgram }) {
  const paragraphs = splitParagraphs(up.description);
  const frame = parseRequirementLines(up.requirements);
  return (
    <PublicLayout>
      <section className="bg-hero text-white py-16">
        <div className="container mx-auto px-4">
          <Link to="/kurse" className="text-white/80 text-sm underline">
            ← Alle Kurse
          </Link>
          <h1 className="font-display text-4xl md:text-5xl font-bold mt-3 mb-3">{up.name}</h1>
          {paragraphs[0] && <p className="text-white/85 max-w-2xl">{paragraphs[0]}</p>}
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-primary-deep">
            <strong>Geplant – noch nicht buchbar.</strong> {NOT_BOOKABLE_NOTE}
          </div>
          <div className="space-y-3 text-muted-foreground">
            {paragraphs.slice(1).map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
          <Card className="border-0 shadow-soft">
            <CardContent className="p-6">
              <h2 className="font-display text-xl font-bold text-primary-deep mb-2">Rahmen</h2>
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                {frame.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="border-0 shadow-soft">
            <CardContent className="p-6 space-y-2 text-sm text-muted-foreground">
              {up.target_group && (
                <Badge variant="outline" className="bg-secondary text-primary-deep border-0">
                  {up.target_group}
                </Badge>
              )}
              {up.age_range && (
                <div className="flex items-center gap-2 pt-2">
                  <Users className="h-4 w-4" />
                  {up.age_range}
                </div>
              )}
              {up.location && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5" />
                  {up.location}
                </div>
              )}
              {up.duration && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {formatDuration(up.duration)}
                </div>
              )}
              <div className="flex items-start gap-2">
                <Tag className="h-4 w-4 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">
                    {formatPrice(up.price_non_member)}
                  </span>{" "}
                  Normalpreis ·{" "}
                  <span className="font-semibold text-primary">{formatPrice(up.price_member)}</span>{" "}
                  für Mitglieder
                </div>
              </div>
              <div className="pt-3 border-t space-y-2">
                {up.waitlist_open ? (
                  <Button asChild variant="accent" className="w-full">
                    <Link to="/warteliste" search={{ programm: up.slug }}>
                      {LABELS.waitlistCta}
                    </Link>
                  </Button>
                ) : (
                  <p className="text-sm font-medium text-muted-foreground">
                    Warteliste derzeit geschlossen
                  </p>
                )}
                <p className="text-[11px] text-center text-muted-foreground">
                  Unverbindliche Anfrage – wir melden uns, sobald Termine feststehen.
                </p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>
    </PublicLayout>
  );
}
