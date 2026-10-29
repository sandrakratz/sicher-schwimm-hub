import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2, Clock, MapPin, Tag, Users } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ConsentCheckbox, FormField, HoneypotField, SubmitButton } from "@/components/form-support";
import { useContactDefaults } from "@/hooks/use-contact-defaults";
import { submitAdultInterest } from "@/lib/adult-interest.functions";
import {
  ADULT_COURSE_PRICE_MEMBER,
  ADULT_COURSE_PRICE_NON_MEMBER,
  ADULT_COURSE_START_LABEL,
  MEMBER_STATUS_STATED,
  SATURDAY_AVAILABILITY,
  SWIM_LEVELS,
  interestInputSchema,
  priceOptions,
} from "@/lib/adult-course";
import type { CourseProgram } from "@/lib/courses-public.functions";

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Ist die Interessenbekundung verbindlich?",
    a: "Nein. Die Interessenbekundung ist unverbindlich und kostenfrei. Sie reserviert keinen Platz und löst keine Zahlung aus. Wir nutzen sie, um den Bedarf einzuschätzen und dich zu informieren, sobald die verbindliche Anmeldung geöffnet wird.",
  },
  {
    q: "Wann kann ich mich verbindlich anmelden?",
    a: "Sobald alle zehn Termine mit Uhrzeiten feststehen und die Trainerplanung gesichert ist. Das geben wir auf dieser Seite bekannt. Du wirst nie automatisch angemeldet – die Anmeldung erfolgt nur, wenn du sie selbst vornimmst.",
  },
  {
    q: "Muss ich schon etwas können?",
    a: "Nein. Der Kurs ist für alle gedacht, die noch nicht schwimmen können, sich im Wasser unsicher fühlen oder vorhandene Grundlagen festigen möchten. Du lernst in deinem Tempo.",
  },
  {
    q: "Wann finden die Termine statt?",
    a: `Der Kurs findet ausschließlich samstags in der Sportschule Hennef statt, geplanter Start ist der ${ADULT_COURSE_START_LABEL}. Die Uhrzeiten hängen von der Belegung der Sportschule ab und können von Termin zu Termin variieren. Den vollständigen Terminplan geben wir vor der verbindlichen Anmeldung bekannt.`,
  },
  {
    q: "Brauche ich eine Vereinsmitgliedschaft?",
    a: "Nein, der Kurs steht auch Nichtmitgliedern offen. Mitglieder zahlen den günstigeren Preis. Die Interessenbekundung begründet weder eine Mitgliedschaft noch einen Anspruch auf den Mitgliederpreis; dieser gilt bei einer späteren Anmeldung nur mit gültiger Vereinsmitgliedschaft.",
  },
  {
    q: "Kann ich einen bestimmten Lernerfolg erwarten?",
    a: "Wir begleiten dich Schritt für Schritt. Wie schnell du Fortschritte machst, ist individuell – einen bestimmten Lernerfolg oder eine bestimmte Schwimmleistung nach zehn Terminen können wir nicht zusagen.",
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl font-bold text-primary-deep">{title}</h2>
      {children}
    </section>
  );
}

function RadioGroup({
  legend,
  name,
  options,
  value,
  onChange,
  error,
}: {
  legend: string;
  name: string;
  options: Array<[string, string]>;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <fieldset className="space-y-2" aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="text-sm font-medium">{legend}</legend>
      {options.map(([v, label]) => (
        <label key={v} className="flex items-start gap-3 rounded-md border p-3 text-sm">
          <input
            type="radio"
            name={name}
            value={v}
            checked={value === v}
            onChange={() => onChange(v)}
            className="mt-0.5 h-4 w-4"
          />
          <span>{label}</span>
        </label>
      ))}
      {error && (
        <p id={`${name}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function InterestForm({
  priceMember,
  priceNonMember,
}: {
  priceMember: number;
  priceNonMember: number;
}) {
  const { defaults, ready } = useContactDefaults();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    swimLevel: "",
    saturdayAvailability: "",
    pricePreference: "",
    memberStatus: "",
    message: "",
    website: "",
    privacyAccepted: false,
  });

  // Bekannte Kontaktdaten angemeldeter Personen vorbelegen (bereits Eingetipptes bleibt)
  useEffect(() => {
    if (!ready || !defaults.signedIn) return;
    setForm((f) => ({
      ...f,
      firstName: f.firstName || defaults.firstName,
      lastName: f.lastName || defaults.lastName,
      email: f.email || defaults.email,
      phone: f.phone || defaults.phone,
    }));
  }, [
    ready,
    defaults.signedIn,
    defaults.firstName,
    defaults.lastName,
    defaults.email,
    defaults.phone,
  ]);

  const set = (k: keyof typeof form, v: string | boolean) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => {
      if (!e[k]) return e;
      const { [k]: _drop, ...rest } = e;
      return rest;
    });
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    if (form.website.trim() !== "") {
      setDone(true);
      return;
    }
    const parsed = interestInputSchema.safeParse({
      ...form,
      memberStatus: form.memberStatus || undefined,
      privacyAccepted: form.privacyAccepted,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      toast.error("Bitte prüfe die markierten Angaben.");
      return;
    }
    setLoading(true);
    try {
      const res = await submitAdultInterest({ data: parsed.data });
      if (!res.ok) throw new Error("not ok");
      setDone(true);
    } catch (err) {
      console.error(err);
      toast.error(
        "Das Absenden hat leider nicht geklappt. Bitte versuche es später erneut oder schreibe an info@sicher-schwimmen.com.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="py-4 text-center">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-success" />
        <h3 className="font-display text-2xl font-bold text-primary-deep">
          Danke für dein Interesse!
        </h3>
        <p className="mt-3 text-muted-foreground">
          Wir haben deine unverbindliche Interessenbekundung erhalten.{" "}
          <strong>Es liegt noch keine verbindliche Anmeldung vor</strong>, es wurde kein Platz
          reserviert und es entstehen keine Kosten. Sobald die Termine feststehen und die
          verbindliche Anmeldung geöffnet ist, melden wir uns bei dir.
        </p>
        <p className="mt-4 text-sm">
          <Link to="/kurse" className="underline">
            Zurück zur Kursübersicht
          </Link>
        </p>
      </div>
    );
  }

  if (!ready) {
    return <p className="py-6 text-center text-muted-foreground">Formular wird vorbereitet…</p>;
  }

  const askMember = defaults.isMember === null;

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <HoneypotField value={form.website} onChange={(v) => set("website", v)} />
      {defaults.signedIn && (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Deine bekannten Kontaktdaten sind bereits eingetragen – bitte nur noch prüfen.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <FormField id="ai-first" label="Vorname *" error={errors.firstName}>
          <Input
            id="ai-first"
            autoComplete="given-name"
            maxLength={60}
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            aria-invalid={Boolean(errors.firstName)}
          />
        </FormField>
        <FormField id="ai-last" label="Nachname *" error={errors.lastName}>
          <Input
            id="ai-last"
            autoComplete="family-name"
            maxLength={60}
            value={form.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            aria-invalid={Boolean(errors.lastName)}
          />
        </FormField>
        <FormField id="ai-email" label="E-Mail-Adresse *" error={errors.email}>
          <Input
            id="ai-email"
            type="email"
            autoComplete="email"
            maxLength={200}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            aria-invalid={Boolean(errors.email)}
          />
        </FormField>
        <FormField id="ai-phone" label="Telefonnummer (optional)" error={errors.phone}>
          <Input
            id="ai-phone"
            type="tel"
            autoComplete="tel"
            maxLength={60}
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </FormField>
      </div>

      <RadioGroup
        legend="Aktueller Schwimmstand *"
        name="swimLevel"
        options={Object.entries(SWIM_LEVELS)}
        value={form.swimLevel}
        onChange={(v) => set("swimLevel", v)}
        error={errors.swimLevel}
      />
      <RadioGroup
        legend="Zeitliche Verfügbarkeit am Samstag *"
        name="saturdayAvailability"
        options={Object.entries(SATURDAY_AVAILABILITY)}
        value={form.saturdayAvailability}
        onChange={(v) => set("saturdayAvailability", v)}
        error={errors.saturdayAvailability}
      />
      <div className="space-y-1">
        <RadioGroup
          legend="Einschätzung zum Preis *"
          name="pricePreference"
          options={Object.entries(priceOptions(priceMember, priceNonMember))}
          value={form.pricePreference}
          onChange={(v) => set("pricePreference", v)}
          error={errors.pricePreference}
        />
        <p className="text-xs text-muted-foreground">
          Diese Auswahl hilft uns bei der Planung. Sie ist keine Preisvereinbarung und löst weder
          eine Mitgliedschaft noch eine Buchung aus.
        </p>
      </div>

      {askMember && (
        <RadioGroup
          legend="Bist du bereits Vereinsmitglied? (optional)"
          name="memberStatus"
          options={Object.entries(MEMBER_STATUS_STATED)}
          value={form.memberStatus}
          onChange={(v) => set("memberStatus", v)}
        />
      )}

      <FormField
        id="ai-message"
        label="Fragen oder Hinweise (optional)"
        hint="Bitte keine Gesundheitsangaben machen – diese sind für die Interessenbekundung nicht nötig."
        error={errors.message}
      >
        <Textarea
          id="ai-message"
          rows={4}
          maxLength={2000}
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
        />
      </FormField>

      <ConsentCheckbox
        id="ai-privacy"
        checked={form.privacyAccepted}
        onCheckedChange={(v) => set("privacyAccepted", v)}
        error={errors.privacyAccepted}
      >
        Ich habe die{" "}
        <Link to="/datenschutz" className="underline" target="_blank">
          Datenschutzhinweise
        </Link>{" "}
        gelesen und bin damit einverstanden, dass der Verein meine Angaben nur zur Planung dieses
        Kurses speichert und mich dazu per E-Mail (und ggf. Telefon) kontaktiert. Werbung ist damit
        nicht verbunden. *
      </ConsentCheckbox>

      <SubmitButton loading={loading} className="w-full sm:w-auto">
        Unverbindlich Interesse anmelden
      </SubmitButton>
      <p className="text-xs text-muted-foreground">
        Kostenfrei und unverbindlich – es entsteht keine Anmeldung, keine Zahlungspflicht und keine
        Platzreservierung.
      </p>
    </form>
  );
}

export function AdultCoursePage({ program }: { program: CourseProgram }) {
  const member = program.price_member ?? ADULT_COURSE_PRICE_MEMBER;
  const nonMember = program.price_non_member ?? ADULT_COURSE_PRICE_NON_MEMBER;

  return (
    <PublicLayout>
      <section className="bg-hero py-16 text-white">
        <div className="container mx-auto px-4">
          <Link to="/kurse" className="text-sm text-white/80 underline">
            ← Alle Kurse
          </Link>
          <h1 className="mb-3 mt-3 font-display text-4xl font-bold md:text-5xl">{program.name}</h1>
          <p className="max-w-2xl text-lg text-white/90">Schwimmen lernen kennt kein Alter.</p>
          <a
            href="#interesse"
            className="mt-6 inline-flex h-12 items-center rounded-md bg-accent px-6 font-semibold text-accent-foreground"
          >
            Unverbindlich Interesse anmelden
          </a>
        </div>
      </section>

      <div className="container mx-auto grid gap-8 px-4 py-12 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          <div
            role="note"
            className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-primary-deep"
          >
            <strong>Geplantes Angebot – die verbindliche Anmeldung ist noch nicht geöffnet.</strong>{" "}
            Du kannst dich jetzt unverbindlich und kostenfrei vormerken lassen. Daraus entsteht
            keine Buchung, keine Zahlungspflicht und keine Platzreservierung.
          </div>

          <Section title="Schwimmen lernen – Schritt für Schritt">
            <p className="text-muted-foreground">
              Du bist erwachsen und kannst noch nicht richtig schwimmen? Du fühlst dich im Wasser
              unsicher oder möchtest mehr Vertrauen in deine Fähigkeiten gewinnen? Dann bist du bei
              Sicher Schwimmen e. V. richtig.
            </p>
            <p className="text-muted-foreground">
              In unserem Erwachsenenschwimmkurs begleiten wir dich Schritt für Schritt auf deinem
              Weg zu mehr Sicherheit im Wasser. Dabei spielt es keine Rolle, ob du bisher kaum
              Schwimmerfahrung hast oder bereits einzelne Schwimmbewegungen beherrschst. Wir
              begegnen dir auf Augenhöhe, nehmen deine individuellen Voraussetzungen ernst und
              gestalten das Training ohne Leistungsdruck.
            </p>
          </Section>

          <Section title="Für wen ist der Kurs geeignet?">
            <p className="text-muted-foreground">
              Für Erwachsene, die noch nicht schwimmen können, sich im Wasser unsicher fühlen oder
              ihre vorhandenen Grundlagen festigen möchten.
            </p>
          </Section>

          <Section title="Voraussetzungen und Schwimmniveaus">
            <p className="text-muted-foreground">
              Du brauchst keine Vorkenntnisse. Wir arbeiten in einer kleinen Lerngruppe und
              berücksichtigen, wo du gerade stehst:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Du kannst noch nicht schwimmen.</li>
              <li>Du kannst einige Meter schwimmen, fühlst dich aber unsicher.</li>
              <li>Du beherrschst die Grundlagen und möchtest sicherer werden.</li>
            </ul>
          </Section>

          <Section title="Lernziele und Kursinhalte">
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Wassergewöhnung und Orientierung im Wasser</li>
              <li>Atmung und Ausatmen ins Wasser</li>
              <li>Wasserlage und Gleiten</li>
              <li>Erste Schwimmbewegungen und Koordination</li>
              <li>Schrittweiser Aufbau selbstständiger Schwimmfähigkeiten</li>
              <li>Mehr Sicherheit und Vertrauen im Wasser</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Wie schnell du Fortschritte machst, ist individuell. Einen bestimmten Lernerfolg oder
              eine bestimmte Schwimmleistung nach zehn Terminen können wir nicht zusagen.
            </p>
          </Section>

          <Section title="Trainerinnen und Trainer, Betreuung">
            <p className="text-muted-foreground">
              Der Kurs wird von qualifizierten Trainern begleitet. Zu unserem Trainerteam gehört
              auch ein Trainer C, der gelernter Schwimmmeister ist.
            </p>
          </Section>

          <Section title="Termine und Ablauf">
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Geplanter Start: Samstag, {ADULT_COURSE_START_LABEL}</li>
              <li>10 Termine mit jeweils 45 Minuten Wasserzeit</li>
              <li>Ausschließlich samstags, in der Sportschule Hennef</li>
              <li>Kleine Lerngruppe mit zunächst maximal 8 Teilnehmenden</li>
            </ul>
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              <strong>Uhrzeiten noch offen:</strong> Sie richten sich nach der Belegung der
              Sportschule und können von Termin zu Termin variieren. Der vollständige Terminplan
              wird vor der verbindlichen Anmeldung bekannt gegeben.
            </p>
          </Section>

          <Section title="Preise">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="border-0 shadow-soft">
                <CardContent className="p-5">
                  <div className="text-sm text-muted-foreground">Vereinsmitglieder</div>
                  <div className="font-display text-3xl font-bold text-primary">{member} €</div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-soft">
                <CardContent className="p-5">
                  <div className="text-sm text-muted-foreground">Nichtmitglieder</div>
                  <div className="font-display text-3xl font-bold text-primary-deep">
                    {nonMember} €
                  </div>
                </CardContent>
              </Card>
            </div>
            <p className="text-sm text-muted-foreground">
              Jeweils für den gesamten Kurs mit zehn Terminen à 45 Minuten Wasserzeit. Der
              Mitgliederpreis gilt bei einer späteren Anmeldung mit gültiger Vereinsmitgliedschaft (
              <Link to="/mitgliedschaft" className="underline">
                Mitglied werden
              </Link>
              ). Die Preise werden mit Öffnung der verbindlichen Anmeldung bestätigt.
            </p>
          </Section>

          <Section title="Häufige Fragen">
            <Accordion type="single" collapsible>
              {FAQ.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Section>

          <section id="interesse" className="scroll-mt-24 space-y-3">
            <h2 className="font-display text-2xl font-bold text-primary-deep">
              Unverbindlich Interesse anmelden
            </h2>
            <Card className="border-0 shadow-soft">
              <CardContent className="pt-6">
                <InterestForm priceMember={member} priceNonMember={nonMember} />
              </CardContent>
            </Card>
          </section>

          <Section title="Wichtig zum Status">
            <p className="text-sm text-muted-foreground">
              Der Kurs ist geplant. Die Interessenbekundung ist unverbindlich und kostenfrei und
              führt nicht zu einer Anmeldung, Platzreservierung, Mitgliedschaft oder Zahlung. Eine
              verbindliche Anmeldung ist erst möglich, wenn wir sie auf dieser Seite öffnen, und
              erfolgt nur durch dich selbst.
            </p>
          </Section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="border-0 shadow-soft">
            <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 h-4 w-4" /> Geplanter Start:{" "}
                {ADULT_COURSE_START_LABEL}
              </div>
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4" /> Samstags, 10 × 45 Minuten Wasserzeit
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4" /> Sportschule Hennef
              </div>
              <div className="flex items-start gap-2">
                <Users className="mt-0.5 h-4 w-4" /> Kleine Gruppe, zunächst max. 8 Personen
              </div>
              <div className="flex items-start gap-2">
                <Tag className="mt-0.5 h-4 w-4" /> {member} € Mitglieder / {nonMember} €
                Nichtmitglieder
              </div>
              <a
                href="#interesse"
                className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-md bg-accent px-4 font-semibold text-accent-foreground"
              >
                Unverbindlich Interesse anmelden
              </a>
            </CardContent>
          </Card>
        </aside>
      </div>
    </PublicLayout>
  );
}
