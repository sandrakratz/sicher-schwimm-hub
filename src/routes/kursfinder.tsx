import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateBerlin, formatPrice, todayBerlinIso } from "@/lib/format";
import { meetsMinAge, minAgeReachedOn, withinMaxAge } from "@/lib/waitlist-age";
import { listCoursePrograms, type CourseProgram } from "@/lib/courses-public.functions";
import { LABELS } from "@/lib/labels";

export const Route = createFileRoute("/kursfinder")({
  loader: async () => await listCoursePrograms(),
  head: () => ({
    meta: [
      { title: "Passenden Schwimmkurs finden | Sicher Schwimmen e.V." },
      {
        name: "description",
        content:
          "In drei Schritten zum passenden Schwimmkurs in Hennef: Geburtsdatum, was Ihr Kind schon kann, freier Termin.",
      },
    ],
  }),
  component: Kursfinder,
});

/**
 * Was das Kind schon kann → welcher Kurs passt. Vom Vorstand festgelegt (24.11.2026):
 * - noch nicht schwimmen → Schwimmstarter
 * - keine Angst im Wasser, bleibt alleine, schwimmt 2 m alleine → Seepferdchen
 * - hat das Seepferdchen (oder schon Bronze/Silber) → Aufbaukurs (Abzeichenkurs Bronze, Silber, Gold)
 */
const LEVELS = [
  {
    id: "starter",
    label: "Kann noch nicht schwimmen",
    hint: "auch wenn es schon gerne im Wasser ist",
    program: /schwimmstarter/i,
    programLabel: "Schwimmstarter",
  },
  {
    id: "seepferdchen",
    label: "Hat keine Angst im Wasser, bleibt alleine und schwimmt 2 Meter alleine",
    hint: "bereit für das erste Abzeichen",
    program: /seepferdchen/i,
    programLabel: "Seepferdchen",
  },
  {
    id: "aufbau",
    label: "Hat schon das Seepferdchen",
    hint: "oder bereits Bronze oder Silber",
    program: /aufbau/i,
    programLabel: "Aufbaukurs (Bronze, Silber, Gold)",
  },
] as const;

type LevelId = (typeof LEVELS)[number]["id"];

function findProgram(programs: CourseProgram[], re: RegExp) {
  return programs.find((p) => re.test(p.slug) || re.test(p.name)) ?? null;
}

function Kursfinder() {
  const programs = Route.useLoaderData();
  const [dob, setDob] = useState("");
  const [level, setLevel] = useState<LevelId | null>(null);
  const step = !dob ? 1 : !level ? 2 : 3;

  return (
    <PublicLayout>
      <section className="bg-hero text-white py-14">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-3">
            Passenden Kurs finden
          </h1>
          <p className="text-white/85 text-lg">
            Drei kurze Fragen – dann zeigen wir Ihnen den passenden Kurs und freie Termine.
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-3xl py-10 space-y-6">
        <ol className="flex gap-2" aria-label="Fortschritt">
          {[1, 2, 3].map((i) => (
            <li
              key={i}
              aria-current={step === i ? "step" : undefined}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-border"}`}
            >
              <span className="sr-only">Schritt {i}</span>
            </li>
          ))}
        </ol>

        <Card className="border-0 shadow-soft">
          <CardContent className="p-6 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Schritt 1
            </div>
            <Label htmlFor="kf-dob" className="font-display text-2xl font-bold text-primary-deep">
              Wann ist Ihr Kind geboren?
            </Label>
            <Input
              id="kf-dob"
              type="date"
              value={dob}
              max={todayBerlinIso()}
              onChange={(e) => setDob(e.target.value)}
              className="max-w-xs h-12 text-base"
            />
            <p className="text-sm text-muted-foreground">
              Damit prüfen wir die Altersgrenzen der Kurse. Gespeichert wird hier nichts.
            </p>
          </CardContent>
        </Card>

        {dob && (
          <Card className="border-0 shadow-soft">
            <CardContent className="p-6 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Schritt 2
              </div>
              <h2 id="kf-level" className="font-display text-2xl font-bold text-primary-deep">
                Was kann Ihr Kind schon?
              </h2>
              <div role="radiogroup" aria-labelledby="kf-level" className="space-y-2">
                {LEVELS.map((l) => {
                  const on = level === l.id;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setLevel(l.id)}
                      className={`w-full min-h-14 rounded-xl border-2 px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        on
                          ? "border-primary bg-secondary"
                          : "border-border bg-card hover:border-primary/50"
                      }`}
                    >
                      <span className="block font-semibold text-foreground">{l.label}</span>
                      <span className="block text-sm text-muted-foreground">{l.hint}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {dob && level && <Recommendation programs={programs} dob={dob} level={level} />}

        <p className="text-sm text-muted-foreground">
          Lieber selbst schauen?{" "}
          <Link to="/kurse" className="font-semibold text-primary underline">
            Alle Kurse ansehen
          </Link>
        </p>
      </div>
    </PublicLayout>
  );
}

function Recommendation({
  programs,
  dob,
  level,
}: {
  programs: CourseProgram[];
  dob: string;
  level: LevelId;
}) {
  const cfg = LEVELS.find((l) => l.id === level)!;
  const program = findProgram(programs, cfg.program);
  const today = todayBerlinIso();

  // Termine, zu denen das Kind vom Alter her passt (Altersgrenzen wie bei der Buchung)
  const fitting = useMemo(() => {
    if (!program) return [];
    return program.terms.filter(
      (t) =>
        meetsMinAge(dob, t.starts_on ?? today, program.min_age_years) &&
        withinMaxAge(dob, t.starts_on ?? today, program.max_age_years),
    );
  }, [program, dob, today]);

  if (!program) {
    return (
      <ResultCard title={cfg.programLabel}>
        <p>
          Dieser Kurs ist noch in Planung. Tragen Sie Ihr Kind unverbindlich ein – wir melden uns,
          sobald es Termine gibt.
        </p>
        <Button asChild variant="accent" size="lg">
          <Link to="/warteliste" search={{ programm: undefined }}>
            {LABELS.waitlistCta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </ResultCard>
    );
  }

  const tooYoung = program.min_age_years != null && !meetsMinAge(dob, today, program.min_age_years);
  const tooOld = program.max_age_years != null && !withinMaxAge(dob, today, program.max_age_years);
  const free = fitting.filter((t) => !t.is_full);
  const bookable = program.bookable && free.length > 0;
  const ageFrom = minAgeReachedOn(dob, program.min_age_years);

  return (
    <ResultCard title={program.name}>
      {program.age_range && <p className="text-sm text-muted-foreground">{program.age_range}</p>}
      {(program.price_member != null || program.price_non_member != null) && (
        <p className="text-sm">
          {program.price_non_member != null && <>{formatPrice(program.price_non_member)}</>}
          {program.price_member != null && <> · Mitglieder {formatPrice(program.price_member)}</>}
        </p>
      )}

      {tooOld ? (
        <p>
          Laut Altersgrenze passt dieser Kurs nicht mehr. Schreiben Sie uns gern – wir finden
          gemeinsam eine Lösung.
        </p>
      ) : tooYoung && fitting.length === 0 ? (
        <p>
          Ihr Kind ist für diesen Kurs noch etwas zu jung
          {ageFrom ? ` (passend ab ${formatDateBerlin(ageFrom)})` : ""}. Auf der Warteliste bieten
          wir Ihnen den ersten passenden Termin an.
        </p>
      ) : free.length > 0 ? (
        <div className="space-y-2">
          <div className="text-sm font-semibold">Freie Termine</div>
          <ul className="space-y-2">
            {free.slice(0, 4).map((t) => (
              <li key={t.id} className="rounded-lg border bg-card p-3 text-sm">
                <div className="font-semibold">{t.name}</div>
                <div className="mt-1 flex flex-wrap gap-3 text-muted-foreground">
                  {t.starts_on && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> ab{" "}
                      {formatDateBerlin(t.starts_on)}
                    </span>
                  )}
                  {t.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {t.location}
                    </span>
                  )}
                  {t.free_slots != null && (
                    <span className="font-semibold text-success">{t.free_slots} frei</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p>
          Im Moment sind alle passenden Termine belegt. Auf der Warteliste bekommen Sie den nächsten
          freien Platz angeboten – unverbindlich.
        </p>
      )}

      <div className="flex flex-wrap gap-3 pt-2">
        {bookable && !tooOld ? (
          <Button asChild variant="accent" size="lg">
            <Link to="/kurse/$slug" params={{ slug: program.slug }}>
              Termin wählen &amp; buchen <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          !tooOld &&
          program.waitlist_open !== false && (
            <Button asChild variant="accent" size="lg">
              <Link to="/warteliste" search={{ programm: program.slug }}>
                {LABELS.waitlistCta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          )
        )}
        <Button asChild variant="outline" size="lg">
          <Link to="/kurse/$slug" params={{ slug: program.slug }}>
            Mehr zum Kurs
          </Link>
        </Button>
        {tooOld && (
          <Button asChild variant="outline" size="lg">
            <Link to="/kontakt">Kontakt</Link>
          </Button>
        )}
      </div>
    </ResultCard>
  );
}

function ResultCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-0 shadow-card bg-secondary/40">
      <CardContent className="p-6 space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Unsere Empfehlung
        </div>
        <h2 className="font-display text-3xl font-bold text-primary-deep">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}
