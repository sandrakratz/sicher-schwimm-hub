import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, MapPin, Users, Tag, CalendarDays, ChevronRight, CheckCircle2, HelpCircle, ClipboardList, Waves, Star, Baby, ArrowDown } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

function InfoItem({ value, icon: Icon, title, subtitle, children }: {
  value: string; icon: typeof Users; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value} className="rounded-xl bg-card shadow-soft border-0 px-5">
      <AccordionTrigger className="hover:no-underline py-4">
        <div className="flex items-center gap-4 text-left">
          <span className="rounded-full bg-secondary p-2.5"><Icon className="h-5 w-5 text-primary" /></span>
          <span>
            <span className="block font-display text-lg font-bold text-primary-deep">{title}</span>
            <span className="block text-sm font-normal text-muted-foreground">{subtitle}</span>
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="text-sm text-muted-foreground pl-14">{children}</AccordionContent>
    </AccordionItem>
  );
}
import { toast } from "sonner";
import { BILLING } from "@/lib/billing-config";
import { BankDetails } from "@/components/BankDetails";
import { BaderegelnCard } from "@/components/BaderegelnCard";
import { formatPrice } from "@/lib/format";
import { termStatus, programAvailability } from "@/lib/course-status";
import { LABELS } from "@/lib/labels";
import { formatDateBerlin } from "@/lib/format";
import { NOT_BOOKABLE_NOTE } from "@/lib/upcoming-programs";
import { PaymentSummary } from "@/components/PaymentSummary";
import { getCourseProgram, bookCourseTerm, type CourseProgram, type CourseTerm } from "@/lib/courses-public.functions";

export const Route = createFileRoute("/kurse_/$slug")({
  loader: async ({ params }) => {
    const program = await getCourseProgram({ data: { slug: params.slug } });
    if (!program) throw notFound();
    return program;
  },
  head: ({ params, loaderData }) => {
    const p = loaderData as CourseProgram | undefined;
    const up = p && p.bookable === false ? p : undefined;
    const title = up
      ? `${up.name} – geplantes Angebot | Sicher Schwimmen e.V.`
      : p
        ? `${p.name} – Schwimmkurs buchen | Sicher Schwimmen e.V.`
        : "Schwimmkurs | Sicher Schwimmen e.V.";
    const desc = up
      ? `${(up.description ?? "").split(/\n/)[0]} Geplantes Angebot – derzeit noch nicht buchbar.`
      : p?.description
      ? `${p.description} Freie Termine online verbindlich buchen.`
      : "Schwimmkurs mit freien Terminen online verbindlich buchen.";
    const url = `https://sicher-schwimmen.com/kurse/${encodeURIComponent(params.slug)}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc.slice(0, 158) },
        { property: "og:title", content: title },
        { property: "og:description", content: desc.slice(0, 158) },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },

  component: ProgramPage,
  errorComponent: () => (
    <PublicLayout>
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold text-primary-deep mb-4">Kurs nicht gefunden</h1>
        <Button asChild><Link to="/kurse">Zur Kursübersicht</Link></Button>
      </section>
    </PublicLayout>
  ),
  notFoundComponent: () => (
    <PublicLayout>
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold text-primary-deep mb-4">Kurs nicht gefunden</h1>
        <Button asChild><Link to="/kurse">Zur Kursübersicht</Link></Button>
      </section>
    </PublicLayout>
  ),
});

function ProgramPage() {
  const data = Route.useLoaderData() as CourseProgram;
  if (data.bookable === false) return <UpcomingProgramPage up={data} />;
  return <BookableProgramPage program={data} />;
}

function UpcomingProgramPage({ up }: { up: CourseProgram }) {
  const paragraphs = (up.description ?? "").split(/\n\s*\n/).filter(Boolean);
  const frame = (up.requirements ?? "").split("\n").filter(Boolean);
  return (
    <PublicLayout>
      <section className="bg-hero text-white py-16">
        <div className="container mx-auto px-4">
          <Link to="/kurse" className="text-white/80 text-sm underline">← Alle Kurse</Link>
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
            {paragraphs.slice(1).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
          </div>
          <Card className="border-0 shadow-soft">
            <CardContent className="p-6">
              <h2 className="font-display text-xl font-bold text-primary-deep mb-2">Rahmen</h2>
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                {frame.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="border-0 shadow-soft">
            <CardContent className="p-6 space-y-2 text-sm text-muted-foreground">
              {up.target_group && <Badge variant="outline" className="bg-secondary text-primary-deep border-0">{up.target_group}</Badge>}
              {up.age_range && <div className="flex items-center gap-2 pt-2"><Users className="h-4 w-4" />{up.age_range}</div>}
              {up.location && <div className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5" />{up.location}</div>}
              {up.duration && <div className="flex items-center gap-2"><Clock className="h-4 w-4" />{up.duration}</div>}
              <div className="flex items-start gap-2">
                <Tag className="h-4 w-4 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">{formatPrice(up.price_non_member)}</span> Normalpreis ·{" "}
                  <span className="font-semibold text-primary">{formatPrice(up.price_member)}</span> für Mitglieder
                </div>
              </div>
              <div className="pt-3 border-t space-y-2">
                {up.waitlist_open ? <Button asChild variant="accent" className="w-full"><Link to="/warteliste" search={{ programm: up.slug }}>{LABELS.waitlistCta}</Link></Button> : <p className="text-sm font-medium text-muted-foreground">Warteliste derzeit geschlossen</p>}
                <p className="text-[11px] text-center text-muted-foreground">Unverbindliche Anfrage – wir melden uns, sobald Termine feststehen.</p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>
    </PublicLayout>
  );
}

function BookableProgramPage({ program }: { program: CourseProgram }) {
  const [bookingTerm, setBookingTerm] = useState<CourseTerm | null>(null);
  const [result, setResult] = useState<{
    status: "confirmed" | "waiting";
    courseName: string;
    startsOn: string | null;
    paymentDueDays: number | null;
    amount: number | null;
  } | null>(null);
  const [blockedNotice, setBlockedNotice] = useState(false);

  const paragraphs = (program.description ?? "").split(/\n\s*\n/).filter(Boolean);
  const requirements = (program.requirements ?? "").split("\n").map((r) => r.trim()).filter(Boolean);
  const openTerms = program.terms.filter((t) => !t.is_full).length;
  const availability = programAvailability({
    openTerms,
    hasTerms: program.terms.length > 0,
    freeSlotsTotal: program.free_slots_total ?? null,
    waitlistCount: program.waitlist_count ?? 0,
  });

  const freeTotal = program.free_slots_total ?? program.terms.reduce((s, t) => s + (t.is_full ? 0 : (t.free_slots ?? 0)), 0);
  const hasFree = openTerms > 0;
  const scrollToTerms = () => document.getElementById("termine")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const waitlistLink = (variant: "outline" | "accent" = "outline", full = false) =>
    program.waitlist_open
      ? <Button asChild variant={variant} className={full ? "w-full" : ""}><Link to="/warteliste" search={{ programm: program.slug }}>Auf die Warteliste <ChevronRight className="h-4 w-4" /></Link></Button>
      : <p className="text-sm font-medium text-muted-foreground">Warteliste derzeit geschlossen</p>;

  const facts: { icon: typeof Tag; label: string; value: React.ReactNode }[] = [];
  if (program.price_member != null || program.price_non_member != null) {
    facts.push({ icon: Tag, label: "Preis", value: (
      <>
        {program.price_non_member != null && <span className="font-semibold text-foreground">{formatPrice(program.price_non_member)}</span>}
        {program.price_member != null && <span className="block text-xs text-primary">{formatPrice(program.price_member)} für Mitglieder</span>}
      </>
    ) });
  }
  if (program.location) facts.push({ icon: MapPin, label: "Ort", value: program.location });
  if (program.age_range) facts.push({ icon: Baby, label: "Alter", value: program.age_range });
  if (program.duration) facts.push({ icon: CalendarDays, label: "Kursdauer", value: program.duration });
  const maxP = program.terms.find((t) => t.max_participants != null)?.max_participants;
  if (maxP) facts.push({ icon: Users, label: "Gruppengröße", value: `max. ${maxP} Kinder` });

  return (
    <PublicLayout>
      <section className="bg-hero text-white py-12 md:py-16">
        <div className="container mx-auto px-4">
          <nav aria-label="Brotkrumen" className="text-white/80 text-sm flex items-center gap-1 flex-wrap">
            <Link to="/" className="hover:underline">Start</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/kurse" className="hover:underline">Kurse</Link>
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
                  {freeTotal > 0 ? `${freeTotal} ${freeTotal === 1 ? "freier Platz" : "freie Plätze"} verfügbar!` : "Freie Plätze verfügbar!"}
                </p>
                <p className="text-sm text-muted-foreground">Buchen Sie jetzt einen passenden Termin – oder setzen Sie Ihr Kind auf die Warteliste.</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-sm text-primary-deep">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge variant="outline" className={availability.className}>{availability.label}</Badge>
              </div>
              {program.terms.length > 0 ? (
                <><strong>Aktuell ausgebucht.</strong> Gerne nehmen wir Sie auf die Warteliste auf – sobald ein Platz frei wird, erhalten Sie automatisch ein Angebot per E-Mail. Vereinsmitglieder werden bevorzugt berücksichtigt.</>
              ) : (
                <><strong>Termine in Planung.</strong> Sobald die Wasserzeiten feststehen, veröffentlichen wir hier die buchbaren Zeiträume.</>
              )}
            </div>
          )}

          {/* Buchbare Termine */}
          <Card id="termine" className="border-0 shadow-soft scroll-mt-24">
            <CardContent className="p-5 md:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <CalendarDays className="h-9 w-9 text-primary shrink-0" />
                <div>
                  <h2 className="font-display text-2xl font-bold text-primary-deep">Buchbare Termine</h2>
                  <p className="text-sm text-muted-foreground">Wählen Sie einfach einen passenden Zeitraum aus und buchen Sie verbindlich einen Platz.</p>
                </div>
              </div>

              {program.terms.length === 0 ? (
                <p className="text-muted-foreground">Für diesen Kurs stehen aktuell keine Termine zur Buchung bereit.</p>
              ) : (
                program.terms.map((t) => (
                  <div key={t.id} className="rounded-xl border bg-card p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start gap-2">
                        <CalendarDays className="h-5 w-5 text-primary mt-1 shrink-0" />
                        <div>
                          <div className="font-display text-lg font-bold text-primary-deep">
                            {t.starts_on ? formatDateBerlin(t.starts_on) : "Termin folgt"}
                            {t.ends_on ? ` – ${formatDateBerlin(t.ends_on)}` : ""}
                          </div>
                          {t.name && <div className="text-xs text-muted-foreground">{t.name}</div>}
                        </div>
                      </div>
                      {t.schedule && <div className="text-sm text-muted-foreground flex items-center gap-2 pl-7"><Clock className="h-4 w-4" />{t.schedule}</div>}
                      {t.location && <div className="text-sm text-muted-foreground flex items-start gap-2 pl-7"><MapPin className="h-4 w-4 mt-0.5" />{t.location}</div>}
                      <div className="text-sm text-muted-foreground flex items-center gap-2 pl-7">
                        <Users className="h-4 w-4" />
                        {t.max_participants != null ? `Max. ${t.max_participants} Kinder pro Kurs` : "Plätze auf Anfrage"}
                      </div>
                      {t.start_tentative && (
                        <div className="text-sm ml-7 rounded bg-accent/15 px-2 py-1 text-foreground">
                          Voraussichtlicher Kursstart – {t.tentative_note || "Termin unter Vorbehalt, kann sich noch verschieben"}. Bei Verschiebung informieren wir alle Eltern; der Kursumfang bleibt erhalten.
                        </div>
                      )}
                      {(t.min_participants || t.lanes) && (
                        <div className="text-xs text-muted-foreground pl-7">
                          {t.lanes ? `${t.lanes} ${t.lanes === 1 ? "Bahn" : "Bahnen"}` : ""}{t.lanes && t.min_participants ? " · " : ""}
                          {t.min_participants ? `Mindestens ${t.min_participants} Teilnehmende – sonst kann der Kurs vor Beginn abgesagt werden` : ""}
                        </div>
                      )}
                      <div className="pl-7 pt-1">
                        {(() => {
                          const st = termStatus(Boolean(t.is_full), t.free_slots);
                          const label = !t.is_full && t.free_slots != null
                            ? `Noch ${t.free_slots} ${t.free_slots === 1 ? "freier Platz" : "freie Plätze"}`
                            : st.label;
                          return <Badge variant="outline" className={st.className}>{label}</Badge>;
                        })()}
                      </div>
                      {t.dates.length > 0 && (
                        <details className="pl-7 mt-2 text-sm">
                          <summary className="cursor-pointer font-medium text-primary">Alle Kurstermine anzeigen ({t.dates.filter(d => d.index != null).length})</summary>
                          <ol className="mt-2 space-y-0.5">
                            {t.dates.map((d, i) => (
                              <li key={i} className={`grid grid-cols-[2rem_6rem_1fr] gap-2 ${d.index == null ? "text-muted-foreground italic" : ""}`}>
                                <span>{d.index != null ? `${d.index}.` : "—"}</span>
                                <span>{formatDateBerlin(d.date)}</span>
                                <span>{d.index == null ? d.note : d.start ? `${d.start}${d.end ? `–${d.end}` : ""} Uhr` : ""}</span>
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}
                    </div>
                    <div className="shrink-0">
                      {t.is_full ? (
                        program.waitlist_open ? <Button asChild variant="outline"><Link to="/warteliste" search={{ programm: program.slug }}>{LABELS.waitlistCta}</Link></Button> : <p className="text-sm font-medium text-muted-foreground">Ausgebucht</p>
                      ) : (
                        <Button variant="accent" size="lg" onClick={() => setBookingTerm(t)}>Verbindlich buchen <ChevronRight className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Auffangnetz Warteliste */}
              <div className="rounded-xl bg-secondary p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <HelpCircle className="h-8 w-8 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-primary-deep">Kein passender Termin dabei?</p>
                  <p className="text-sm text-muted-foreground">Sie möchten lieber einen anderen Zeitraum oder es sind gerade alle Plätze belegt? Wir melden uns, sobald ein Platz frei wird.</p>
                </div>
                <div className="shrink-0">{waitlistLink("outline")}</div>
              </div>

              <p className="text-xs text-muted-foreground">
                Mit der Buchung gelten unsere{" "}
                <Link to="/kursbedingungen" className="text-primary underline font-semibold">Kursteilnahmebedingungen</Link>.
                Die Buchung ist verbindlich; ein 14-tägiges{" "}
                <Link to="/widerruf" className="text-primary underline font-semibold">Widerrufsrecht</Link> besteht.
              </p>
            </CardContent>
          </Card>

          {/* Infos als Akkordeon */}
          <Accordion type="multiple" className="space-y-3">
            {(requirements.length > 0 || program.min_age_years != null) && (
              <InfoItem value="req" icon={Users} title="Voraussetzungen & Mindestalter" subtitle="Was sollte Ihr Kind mitbringen?">
                {requirements.length > 1 ? (
                  <ul className="list-disc pl-5 space-y-1">{requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
                ) : requirements[0] ? <p>{requirements[0]}</p> : null}
                {program.min_age_years != null && <p className="mt-2 text-xs">Mindestalter zu Kursbeginn: {program.min_age_years} Jahre.</p>}
              </InfoItem>
            )}
            {program.course_info && (
              <InfoItem value="info" icon={ClipboardList} title="Ablauf & Wichtiges am Kurstag" subtitle="Von der Ankunft bis zum Ende.">
                <p className="whitespace-pre-line">{program.course_info}</p>
              </InfoItem>
            )}
            {paragraphs.length > 1 && (
              <InfoItem value="desc" icon={Waves} title="Kursbeschreibung" subtitle={`Was lernt Ihr Kind bei „${program.name}“?`}>
                <div className="space-y-3">{paragraphs.slice(1).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>
              </InfoItem>
            )}
            <InfoItem value="faq" icon={HelpCircle} title="Häufige Fragen" subtitle="Die wichtigsten Fragen kurz beantwortet.">
              <p>Antworten zu Buchung, Bezahlung, Absage und Warteliste finden Sie in unseren{" "}
                <Link to="/faq" className="text-primary underline font-semibold">häufigen Fragen</Link>.</p>
            </InfoItem>
          </Accordion>

          <div className="rounded-xl bg-card shadow-soft p-5 flex items-start gap-3">
            <Star className="h-6 w-6 text-accent shrink-0" />
            <div>
              <p className="font-display font-bold text-primary-deep">Unser Ziel</p>
              <p className="text-sm text-muted-foreground">Mit Freude und Sicherheit schwimmen lernen – und stolz den Kurs „{program.name}“ abschließen.</p>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="border-0 shadow-soft">
            <CardContent className="p-6 space-y-4 text-sm">
              <h2 className="font-display text-lg font-bold text-primary-deep">Kurs auf einen Blick</h2>
              {program.target_group && <Badge variant="outline" className="bg-secondary text-primary-deep border-0">{program.target_group}</Badge>}
              <dl className="divide-y">
                {facts.map((f) => (
                  <div key={f.label} className="flex items-start gap-3 py-2">
                    <f.icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <dt className="font-semibold text-foreground w-28 shrink-0">{f.label}</dt>
                    <dd className="text-muted-foreground">{f.value}</dd>
                  </div>
                ))}
              </dl>
              {hasFree ? (
                <div className="rounded-xl bg-success/10 border border-success/30 p-4 space-y-3 text-center">
                  <p className="font-semibold text-success flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    {freeTotal > 0 ? `${freeTotal} ${freeTotal === 1 ? "freier Platz" : "freie Plätze"} verfügbar!` : "Freie Plätze verfügbar!"}
                  </p>
                  <Button variant="accent" className="w-full" onClick={scrollToTerms}>Zu den freien Terminen <ArrowDown className="h-4 w-4" /></Button>
                  {program.waitlist_open && (
                    <Link to="/warteliste" search={{ programm: program.slug }} className="block text-xs text-primary underline">
                      Oder unverbindlich auf die Warteliste
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {waitlistLink("accent", true)}
                  <p className="text-[11px] text-center text-muted-foreground">Unverbindliche Anfrage – wir melden uns persönlich bei Ihnen.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-soft">
            <CardContent className="p-6 text-sm">
              <h2 className="font-display text-lg font-bold text-primary-deep mb-2">Bankverbindung</h2>
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
        onSuccess={(r) => { setBookingTerm(null); setResult(r); }}
        onBlocked={() => { setBookingTerm(null); setBlockedNotice(true); }}
      />

      <AlertDialog open={blockedNotice} onOpenChange={(o) => { if (!o) { setBlockedNotice(false); window.location.reload(); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Einzelfallprüfung erforderlich</AlertDialogTitle>
            <AlertDialogDescription>
              Für diese Anmeldung ist eine Einzelfallprüfung durch den Vorstand erforderlich, eine direkte Buchung ist
              daher nicht möglich. Wir haben Ihre Angaben als Kursanfrage aufgenommen und melden uns persönlich bei Ihnen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => { setBlockedNotice(false); window.location.reload(); }}>Alles klar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={result !== null} onOpenChange={(o) => { if (!o) { setResult(null); window.location.reload(); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {result?.status === "waiting" ? "Auf die Warteliste gesetzt" : "Buchung bestätigt"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {result?.status === "waiting"
                ? `Der Kurs „${result?.courseName}“ ist inzwischen ausgebucht. Wir haben Sie auf die Warteliste gesetzt und melden uns, sobald ein Platz frei wird. Eine Bestätigung per E-Mail ist unterwegs.`
                : `Ihre Buchung für „${result?.courseName}“ ist verbindlich eingegangen. Sie erhalten in Kürze eine Bestätigung per E-Mail mit allen Zahlungsinformationen.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {result?.status === "confirmed" && (
            <PaymentSummary
              startsOn={result.startsOn}
              paymentDueDays={result.paymentDueDays}
              amount={result.amount}
            />
          )}
          <AlertDialogFooter>

            <AlertDialogAction onClick={() => { setResult(null); window.location.reload(); }}>Alles klar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </PublicLayout>
  );
}

function BookingDialog({
  program, term, onClose, onSuccess, onBlocked,
}: {
  program: CourseProgram;
  term: CourseTerm | null;
  onClose: () => void;
  onSuccess: (r: {
    status: "confirmed" | "waiting";
    courseName: string;
    startsOn: string | null;
    paymentDueDays: number | null;
    amount: number | null;
  }) => void;
  onBlocked: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    parentFirstName: "", parentLastName: "", parentEmail: "", parentPhone: "",
    parentStreet: "", parentZip: "", parentCity: "",
    childName: "", childLastName: "", childDob: "", healthInfo: "", message: "",
    isMember: false, acceptTerms: false, gdprConsent: false, healthConsent: false, website: "",
  });

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const [siblings, setSiblings] = useState<Array<{ childName: string; childLastName: string; childDob: string; healthInfo: string }>>([]);
  const setSib = (i: number, k: "childName" | "childLastName" | "childDob" | "healthInfo", v: string) =>
    setSiblings((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const parentLast = form.parentLastName.trim();
  const hasHealthInfo = Boolean(form.healthInfo.trim()) || siblings.some((k) => k.healthInfo.trim());
  const fullName = (first: string, last: string) => `${first.trim()} ${last.trim()}`.trim();

  const price = form.isMember
    ? term?.price_member ?? program.price_member ?? null
    : term?.price_non_member ?? program.price_non_member ?? null;
  const totalPrice = price != null ? price * (1 + siblings.length) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term) return;
    if (!form.acceptTerms || !form.gdprConsent) {
      toast.error("Bitte bestätigen Sie die Kursbedingungen und die Datenschutzhinweise.");
      return;
    }
    if (hasHealthInfo && !form.healthConsent) {
      toast.error("Bitte willigen Sie in die Verarbeitung der Gesundheitsangaben ein oder löschen Sie diese Angaben.");
      return;
    }
    setSubmitting(true);
    try {
      const kids = [
        { childName: fullName(form.childName, form.childLastName), childDob: form.childDob, healthInfo: form.healthInfo },
        ...siblings.filter((k) => k.childName.trim()).map((k) => ({ ...k, childName: fullName(k.childName, k.childLastName) })),
      ];
      if (kids.some((k) => k.childName.split(/\s+/).length < 2)) {
        toast.error("Bitte Vor- und Nachnamen jedes Kindes angeben.");
        setSubmitting(false);
        return;
      }
      let res: any = null;
      const confirmed: string[] = [];
      const waiting: string[] = [];
      const failed: string[] = [];
      for (const kid of kids) {
        let r: any;
        try {
          r = await bookCourseTerm({
            data: {
              courseId: term.id,
              parentName: fullName(form.parentFirstName, form.parentLastName),
              parentEmail: form.parentEmail,
              parentPhone: form.parentPhone,
              parentStreet: form.parentStreet,
              parentZip: form.parentZip,
              parentCity: form.parentCity,
              childName: kid.childName,
              childDob: kid.childDob,
              healthInfo: kid.healthInfo,
              healthConsent: kid.healthInfo.trim() ? true : undefined,
              message: form.message,
              isMember: form.isMember,
              acceptTerms: true,
              gdprConsent: true,
              website: form.website,
            },
          });
        } catch (err) {
          // Erstes Kind ohne Erfolg → normale Fehlermeldung, nichts wurde gebucht.
          if (!res) throw err;
          failed.push(kid.childName);
          toast.error(`${kid.childName}: ${err instanceof Error ? err.message : "konnte nicht gebucht werden."}`);
          continue;
        }
        if (r?.blocked) {
          if (!res) { onBlocked(); return; }
          failed.push(kid.childName);
          toast.error(`${kid.childName} konnte nicht gebucht werden. Bitte kontaktieren Sie uns.`);
          continue;
        }
        res = res ?? r;
        (r?.status === "waiting" ? waiting : confirmed).push(kid.childName);
      }
      if (!res) return;
      const booked = [...confirmed, ...waiting];
      if (confirmed.length && waiting.length) {
        toast.info(`Auf der Warteliste: ${waiting.join(", ")}`);
      }
      if (failed.length) {
        toast.warning(`Gebucht wurde: ${booked.join(", ")}. Nicht gebucht: ${failed.join(", ")} – bitte nicht erneut absenden, sondern uns kontaktieren.`, { duration: 12000 });
      }
      onSuccess({
        status: confirmed.length ? "confirmed" : "waiting",
        courseName: `${res.courseName ?? term.name}${booked.length > 1 ? ` (${booked.join(", ")})` : ""}`,
        startsOn: term.starts_on,
        paymentDueDays: program.payment_due_days,
        amount: price != null && confirmed.length ? price * confirmed.length : null,
      });

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Die Buchung konnte nicht abgeschlossen werden.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={term !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Verbindlich buchen</DialogTitle>
          <DialogDescription>
            {program.name}
            {term?.starts_on ? ` · ${formatDateBerlin(term.starts_on)}${term.ends_on ? ` – ${formatDateBerlin(term.ends_on)}` : ""}` : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <input
            type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
            className="hidden" value={form.website} onChange={(e) => set("website", e.target.value)}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="parentFirstName">Vorname Erziehungsberechtigte:r *</Label>
              <Input id="parentFirstName" required maxLength={60} value={form.parentFirstName} onChange={(e) => set("parentFirstName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parentLastName">Nachname Erziehungsberechtigte:r *</Label>
              <Input id="parentLastName" required maxLength={60} value={form.parentLastName} onChange={(e) => set("parentLastName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parentEmail">E-Mail *</Label>
              <Input id="parentEmail" type="email" required value={form.parentEmail} onChange={(e) => set("parentEmail", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parentPhone">Telefon (für Notfälle) *</Label>
              <Input id="parentPhone" type="tel" required minLength={5} maxLength={60} value={form.parentPhone} onChange={(e) => set("parentPhone", e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="parentStreet">Straße und Hausnummer *</Label>
              <Input id="parentStreet" required value={form.parentStreet} onChange={(e) => set("parentStreet", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parentZip">PLZ *</Label>
              <Input id="parentZip" required inputMode="numeric" value={form.parentZip} onChange={(e) => set("parentZip", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parentCity">Ort *</Label>
              <Input id="parentCity" required value={form.parentCity} onChange={(e) => set("parentCity", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="childName">Vorname des Kindes *</Label>
              <Input id="childName" required value={form.childName} onChange={(e) => set("childName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="childLastName">Nachname des Kindes *</Label>
              <Input id="childLastName" required value={form.childLastName} placeholder={parentLast || undefined}
                onFocus={() => { if (!form.childLastName && parentLast) set("childLastName", parentLast); }}
                onChange={(e) => set("childLastName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="childDob">Geburtsdatum des Kindes *</Label>
              <Input id="childDob" type="date" required value={form.childDob} onChange={(e) => set("childDob", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="healthInfo">Gesundheitliche Hinweise (freiwillig)</Label>
            <Textarea id="healthInfo" rows={2} value={form.healthInfo} onChange={(e) => set("healthInfo", e.target.value)} />
          </div>
          {siblings.map((k, i) => (
            <div key={i} className="rounded-md border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Geschwisterkind {i + 1}</div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSiblings((l) => l.filter((_, j) => j !== i))}>Entfernen</Button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Vorname *</Label>
                  <Input required value={k.childName} onChange={(e) => setSib(i, "childName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nachname *</Label>
                  <Input required value={k.childLastName} onChange={(e) => setSib(i, "childLastName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Geburtsdatum *</Label>
                  <Input type="date" required value={k.childDob} onChange={(e) => setSib(i, "childDob", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Gesundheitliche Hinweise (freiwillig)</Label>
                <Textarea rows={2} value={k.healthInfo} onChange={(e) => setSib(i, "healthInfo", e.target.value)} />
              </div>
            </div>
          ))}
          {siblings.length < 3 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setSiblings((l) => [...l, { childName: "", childLastName: form.childLastName || parentLast, childDob: "", healthInfo: "" }])}>
              + Weiteres Kind anmelden (Geschwister)
            </Button>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="message">Nachricht</Label>
            <Textarea id="message" rows={2} value={form.message} onChange={(e) => set("message", e.target.value)} />
          </div>

          {hasHealthInfo && (
            <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
              <Checkbox id="healthConsent" checked={form.healthConsent} onCheckedChange={(v) => set("healthConsent", Boolean(v))} />
              <Label htmlFor="healthConsent" className="text-sm font-normal leading-snug">
                Ich willige ausdrücklich ein, dass der Verein die oben gemachten Gesundheitsangaben zur
                sicheren Durchführung des Kurses verarbeitet (Art. 9 Abs. 2 lit. a DSGVO). Die Angabe ist
                freiwillig; ich kann die Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen
                (info@sicher-schwimmen.com). *
              </Label>
            </div>
          )}

          <div className="flex items-start gap-2">
            <Checkbox id="isMember" checked={form.isMember} onCheckedChange={(v) => set("isMember", Boolean(v))} />
            <Label htmlFor="isMember" className="text-sm font-normal leading-snug">
              Wir sind Mitglied im Sicher-Schwimmen e.V. (Mitgliedspreis
              {program.price_member != null ? ` ${formatPrice(program.price_member)}` : ""})
            </Label>
          </div>
          <PaymentSummary
            startsOn={term?.starts_on}
            paymentDueDays={program.payment_due_days}
            amount={totalPrice}
          />

          <div className="flex items-start gap-2">
            <Checkbox id="acceptTerms" checked={form.acceptTerms} onCheckedChange={(v) => set("acceptTerms", Boolean(v))} />
            <Label htmlFor="acceptTerms" className="text-sm font-normal leading-snug">
              Ich buche verbindlich und akzeptiere die{" "}
              <Link to="/kursbedingungen" className="underline text-primary" target="_blank">Kursteilnahmebedingungen</Link>. *
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id="gdprConsent" checked={form.gdprConsent} onCheckedChange={(v) => set("gdprConsent", Boolean(v))} />
            <Label htmlFor="gdprConsent" className="text-sm font-normal leading-snug">
              Ich habe die{" "}
              <Link to="/datenschutz" className="underline text-primary" target="_blank">Datenschutzhinweise</Link> gelesen. *
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Abbrechen</Button>
            <Button type="submit" variant="accent" disabled={submitting}>
              {submitting ? "Wird gebucht…" : "Verbindlich buchen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
