import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  Baby,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  HelpCircle,
  MapPin,
  Star,
  Tag,
  Users,
  Waves,
} from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BankDetails } from "@/components/BankDetails";
import { BaderegelnCard } from "@/components/BaderegelnCard";
import { AdultBookingDialog, type BookingSuccess } from "@/components/AdultBookingDialog";
import { track } from "@/lib/analytics/client";
import { useExperiment } from "@/lib/analytics/useExperiment";
import { BILLING } from "@/lib/billing-config";
import { programAvailability } from "@/lib/course-status";
import { formatDuration, formatPrice } from "@/lib/format";
import { LABELS } from "@/lib/labels";
import { parseRequirementLines } from "@/lib/upcoming-programs";
import { isAdultProgram } from "@/lib/adult-course";
import type { CourseProgram, CourseTerm } from "@/lib/courses-public.functions";
import { BlockedBookingDialog, BookingResultDialog } from "./BookingOutcomeDialogs";
import { ChildBookingDialog } from "./ChildBookingDialog";
import { CourseTermCard } from "./CourseTermCard";
import { MEMBER_DISCOUNT_NOTE, availableText, splitParagraphs } from "./course-page-helpers";

function InfoItem({
  value,
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  value: string;
  icon: typeof Users;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <AccordionItem value={value} className="rounded-xl bg-card shadow-soft border-0 px-5">
      <AccordionTrigger className="hover:no-underline py-4">
        <div className="flex items-center gap-4 text-left">
          <span className="rounded-full bg-secondary p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </span>
          <span>
            <span className="block font-display text-lg font-bold text-primary-deep">{title}</span>
            <span className="block text-sm font-normal text-muted-foreground">{subtitle}</span>
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="text-sm text-muted-foreground pl-14">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

type Fact = { icon: typeof Tag; label: string; value: ReactNode };

/** Eckdaten für „Kurs auf einen Blick“ (nur vorhandene Angaben). */
function programFacts(program: CourseProgram): Fact[] {
  const facts: Fact[] = [];
  if (program.price_member != null || program.price_non_member != null) {
    facts.push({
      icon: Tag,
      label: "Preis",
      value: (
        <>
          {program.price_non_member != null && (
            <span className="font-semibold text-foreground">
              {formatPrice(program.price_non_member)}
            </span>
          )}
          {program.price_member != null && (
            <span className="block text-xs text-primary">
              {formatPrice(program.price_member)} für Mitglieder
            </span>
          )}
        </>
      ),
    });
  }
  if (program.location) facts.push({ icon: MapPin, label: "Ort", value: program.location });
  if (program.age_range) facts.push({ icon: Baby, label: "Alter", value: program.age_range });
  if (program.duration)
    facts.push({
      icon: CalendarDays,
      label: "Kursdauer",
      value: formatDuration(program.duration) ?? "",
    });
  const maxP = program.terms.find((t) => t.max_participants != null)?.max_participants;
  if (maxP) facts.push({ icon: Users, label: "Gruppengröße", value: `max. ${maxP} Kinder` });
  return facts;
}

/** Buchbares Angebot: Termine, Infos, Buchungsdialog (Kinder- oder Erwachsenenformular). */
export function BookableProgramPage({ program }: { program: CourseProgram }) {
  const [bookingTerm, setBookingTerm] = useState<CourseTerm | null>(null);
  const [result, setResult] = useState<BookingSuccess | null>(null);
  const [blockedNotice, setBlockedNotice] = useState(false);
  const isAdult = isAdultProgram(program);
  // A/B-Test (nur Kinderkurse): Beschriftung der Schaltfläche, die das Formular öffnet
  const bookButtonVariant = useExperiment("kurs_buchen_button", !isAdult);
  const bookLabel =
    bookButtonVariant === "platz_sichern" ? "Jetzt Platz sichern" : "Verbindlich buchen";

  const paragraphs = splitParagraphs(program.description);
  const requirements = parseRequirementLines(program.requirements);
  const openTerms = program.terms.filter((t) => !t.is_full).length;
  const availability = programAvailability({
    openTerms,
    hasTerms: program.terms.length > 0,
    freeSlotsTotal: program.free_slots_total ?? null,
    waitlistCount: program.waitlist_count ?? 0,
  });

  const freeTotal =
    program.free_slots_total ??
    program.terms.reduce((s, t) => s + (t.is_full ? 0 : (t.free_slots ?? 0)), 0);
  const hasFree = openTerms > 0;
  const facts = programFacts(program);
  const waitlistLink = () =>
    program.waitlist_open ? (
      <Button asChild variant="accent">
        <Link to="/warteliste" search={{ programm: program.slug }}>
          {LABELS.waitlistCta} <ChevronRight className="h-4 w-4" />
        </Link>
      </Button>
    ) : (
      <p className="text-sm font-medium text-muted-foreground">Warteliste derzeit geschlossen</p>
    );

  // Je Kursart das passende Formular: Angebote für Erwachsene fragen keine Kinderangaben ab
  const BookingDialog = isAdult ? AdultBookingDialog : ChildBookingDialog;

  return (
    <PublicLayout>
      <section className="bg-hero text-white py-12 md:py-16">
        <div className="container mx-auto px-4">
          <nav
            aria-label="Brotkrumen"
            className="text-white/80 text-sm flex items-center gap-1 flex-wrap"
          >
            <Link to="/" className="hover:underline">
              Start
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/kurse" className="hover:underline">
              Kurse
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white">{program.name}</span>
          </nav>
          <h1 className="font-display text-4xl md:text-5xl font-bold mt-3 mb-3">{program.name}</h1>
          {paragraphs[0] && <p className="text-white/85 max-w-2xl text-lg">{paragraphs[0]}</p>}
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Verfügbarkeits-Banner */}
          {hasFree ? (
            <div className="rounded-xl border border-success/30 bg-success/10 p-5 flex items-center gap-4">
              <CheckCircle2 className="h-10 w-10 text-success shrink-0" />
              <div>
                <p className="font-display text-xl md:text-2xl font-bold text-success">
                  {availableText(freeTotal)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Wählen Sie unten einen passenden Termin und buchen Sie verbindlich.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-sm text-primary-deep">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge variant="outline" className={availability.className}>
                  {availability.label}
                </Badge>
              </div>
              {program.terms.length > 0 ? (
                <>
                  <strong>Aktuell ausgebucht.</strong> Gerne nehmen wir Sie auf die Warteliste auf –
                  sobald ein Platz frei wird, erhalten Sie automatisch ein Angebot per E-Mail.
                  Vereinsmitglieder werden bevorzugt berücksichtigt.
                </>
              ) : (
                <>
                  <strong>Termine in Planung.</strong> Sobald die Wasserzeiten feststehen,
                  veröffentlichen wir hier die buchbaren Zeiträume.
                </>
              )}
            </div>
          )}

          {/* Buchbare Termine */}
          <Card id="termine" className="border-0 shadow-soft scroll-mt-24">
            <CardContent className="p-5 md:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <CalendarDays className="h-9 w-9 text-primary shrink-0" />
                <div>
                  <h2 className="font-display text-2xl font-bold text-primary-deep">
                    {hasFree ? "Buchbare Termine" : "Termine"}
                  </h2>
                  {hasFree ? (
                    <p className="text-sm text-muted-foreground">
                      Wählen Sie einfach einen passenden Zeitraum aus und buchen Sie verbindlich
                      einen Platz.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {program.terms.length > 0
                        ? "Alle Termine sind derzeit ausgebucht."
                        : "Neue Termine sind in Planung."}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">{MEMBER_DISCOUNT_NOTE}</p>
                </div>
              </div>

              {/* Einzige Warteliste-Aktion der Seite: nur wenn kein Termin buchbar ist –
                  oben, damit man sie am Handy nicht erst nach allen vollen Terminen findet */}
              {!hasFree && (
                <div className="rounded-xl bg-secondary p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <HelpCircle className="h-8 w-8 text-primary shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-primary-deep">Auf die Warteliste</p>
                    <p className="text-sm text-muted-foreground">
                      Unverbindlich: Wird ein Platz frei, bieten wir ihn Ihnen per E-Mail an.
                    </p>
                  </div>
                  <div className="shrink-0">{waitlistLink()}</div>
                </div>
              )}

              {program.terms.length === 0 ? (
                <p className="text-muted-foreground">
                  Für diesen Kurs stehen aktuell keine Termine zur Buchung bereit.
                </p>
              ) : (
                program.terms.map((t) => (
                  <CourseTermCard
                    key={t.id}
                    term={t}
                    program={program}
                    bookLabel={bookLabel}
                    showWaitlist={hasFree}
                    onBook={() => {
                      track("cta_click", { cta: "kurs_verbindlich_buchen" });
                      setBookingTerm(t);
                    }}
                  />
                ))
              )}

              <p className="text-xs text-muted-foreground">
                Mit der Buchung gelten unsere{" "}
                <Link to="/kursbedingungen" className="text-primary underline font-semibold">
                  Kursteilnahmebedingungen
                </Link>
                . Die Buchung ist verbindlich; ein 14-tägiges{" "}
                <Link to="/widerruf" className="text-primary underline font-semibold">
                  Widerrufsrecht
                </Link>{" "}
                besteht.
              </p>
            </CardContent>
          </Card>

          {/* Infos als Akkordeon */}
          <Accordion type="multiple" className="space-y-3">
            {(requirements.length > 0 ||
              program.min_age_years != null ||
              program.max_age_years != null) && (
              <InfoItem
                value="req"
                icon={Users}
                title="Voraussetzungen & Mindestalter"
                subtitle="Was sollte Ihr Kind mitbringen?"
              >
                {requirements.length > 1 ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {requirements.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                ) : requirements[0] ? (
                  <p>{requirements[0]}</p>
                ) : null}
                {program.min_age_years != null && (
                  <p className="mt-2 text-xs">
                    Mindestalter zu Kursbeginn: {program.min_age_years} Jahre.
                  </p>
                )}
                {program.max_age_years != null && (
                  <p className="mt-2 text-xs">
                    Höchstalter zu Kursbeginn: {program.max_age_years} Jahre.
                  </p>
                )}
              </InfoItem>
            )}
            {program.course_info && (
              <InfoItem
                value="info"
                icon={ClipboardList}
                title="Ablauf & Wichtiges am Kurstag"
                subtitle="Von der Ankunft bis zum Ende."
              >
                <p className="whitespace-pre-line">{program.course_info}</p>
              </InfoItem>
            )}
            {paragraphs.length > 1 && (
              <InfoItem
                value="desc"
                icon={Waves}
                title="Kursbeschreibung"
                subtitle={`Was lernt Ihr Kind bei „${program.name}“?`}
              >
                <div className="space-y-3">
                  {paragraphs.slice(1).map((p, i) => (
                    <p key={i} className="whitespace-pre-line">
                      {p}
                    </p>
                  ))}
                </div>
              </InfoItem>
            )}
            <InfoItem
              value="faq"
              icon={HelpCircle}
              title="Häufige Fragen"
              subtitle="Die wichtigsten Fragen kurz beantwortet."
            >
              <p>
                Antworten zu Buchung, Bezahlung, Absage und Warteliste finden Sie in unseren{" "}
                <Link to="/faq" className="text-primary underline font-semibold">
                  häufigen Fragen
                </Link>
                .
              </p>
            </InfoItem>
          </Accordion>

          <div className="rounded-xl bg-card shadow-soft p-5 flex items-start gap-3">
            <Star className="h-6 w-6 text-accent shrink-0" />
            <div>
              <p className="font-display font-bold text-primary-deep">Unser Ziel</p>
              <p className="text-sm text-muted-foreground">
                Mit Freude und Sicherheit schwimmen lernen – und stolz den Kurs „{program.name}“
                abschließen.
              </p>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="border-0 shadow-soft">
            <CardContent className="p-6 space-y-4 text-sm">
              <h2 className="font-display text-lg font-bold text-primary-deep">
                Kurs auf einen Blick
              </h2>
              {program.target_group && (
                <Badge variant="outline" className="bg-secondary text-primary-deep border-0">
                  {program.target_group}
                </Badge>
              )}
              <dl className="divide-y">
                {facts.map((f) => (
                  <div key={f.label} className="flex items-start gap-3 py-2">
                    <f.icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <dt className="font-semibold text-foreground w-28 shrink-0">{f.label}</dt>
                    <dd className="text-muted-foreground">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-soft">
            <CardContent className="p-6 text-sm">
              <h2 className="font-display text-lg font-bold text-primary-deep mb-2">
                Bankverbindung
              </h2>
              <p className="text-muted-foreground mb-3">{BILLING.dueNote}</p>
              <BankDetails variant="compact" />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-soft">
            <CardContent className="p-6">
              <BaderegelnCard variant="compact" />
            </CardContent>
          </Card>
        </aside>
      </section>

      <BookingDialog
        program={program}
        term={bookingTerm}
        onClose={() => setBookingTerm(null)}
        onSuccess={(r) => {
          setBookingTerm(null);
          setResult(r);
        }}
        onBlocked={() => {
          setBookingTerm(null);
          setBlockedNotice(true);
        }}
      />
      <BlockedBookingDialog open={blockedNotice} onClose={() => setBlockedNotice(false)} />
      <BookingResultDialog result={result} onClose={() => setResult(null)} />
    </PublicLayout>
  );
}
