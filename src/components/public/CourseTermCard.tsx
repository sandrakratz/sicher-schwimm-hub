import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Clock, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { termStatus } from "@/lib/course-status";
import { formatDateBerlin, todayBerlinIso } from "@/lib/format";
import { LABELS } from "@/lib/labels";
import type { CourseProgram, CourseTerm } from "@/lib/courses-public.functions";
import { formatTermRange, freeSlotsText } from "./course-page-helpers";

/** Hinweisbox innerhalb einer Terminkarte (Vorbehalt, Uhrzeiten). */
const NOTICE = "text-sm ml-7 rounded bg-accent/15 px-2 py-1 text-foreground";

function TermStatusBadge({ term }: { term: CourseTerm }) {
  const st = termStatus(Boolean(term.is_full), term.free_slots);
  const label =
    !term.is_full && term.free_slots != null ? `Noch ${freeSlotsText(term.free_slots)}` : st.label;
  return (
    <Badge variant="outline" className={st.className}>
      {label}
    </Badge>
  );
}

function TermDates({ dates }: { dates: CourseTerm["dates"] }) {
  return (
    <details className="pl-7 mt-2 text-sm">
      <summary className="cursor-pointer font-medium text-primary">
        Alle Kurstermine anzeigen ({dates.filter((d) => d.index != null).length})
      </summary>
      <ol className="mt-2 space-y-0.5">
        {dates.map((d, i) => (
          <li
            key={i}
            className={`grid grid-cols-[2rem_6rem_1fr] gap-2 ${d.index == null ? "text-muted-foreground italic" : ""}`}
          >
            <span>{d.index != null ? `${d.index}.` : "—"}</span>
            <span>{formatDateBerlin(d.date)}</span>
            <span>
              {d.index == null
                ? d.note
                : d.start
                  ? `${d.start}${d.end ? `–${d.end}` : ""} Uhr`
                  : ""}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}

/** Ein buchbarer Termin mit allen Eckdaten und dem passenden Knopf (Buchen / Warteliste). */
export function CourseTermCard({
  term: t,
  program,
  bookLabel,
  onBook,
}: {
  term: CourseTerm;
  program: Pick<CourseProgram, "slug" | "waitlist_open">;
  bookLabel: string;
  onBook: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 space-y-1">
        <div className="flex items-start gap-2">
          <CalendarDays className="h-5 w-5 text-primary mt-1 shrink-0" />
          <div>
            <div className="font-display text-lg font-bold text-primary-deep">
              {formatTermRange(t.starts_on, t.ends_on)}
            </div>
            {t.name && <div className="text-xs text-muted-foreground">{t.name}</div>}
          </div>
        </div>
        {t.schedule && (
          <div className="text-sm text-muted-foreground flex items-center gap-2 pl-7">
            <Clock className="h-4 w-4" />
            {t.schedule}
          </div>
        )}
        {t.location && (
          <div className="text-sm text-muted-foreground flex items-start gap-2 pl-7">
            <MapPin className="h-4 w-4 mt-0.5" />
            {t.location}
          </div>
        )}
        <div className="text-sm text-muted-foreground flex items-center gap-2 pl-7">
          <Users className="h-4 w-4" />
          {t.max_participants != null
            ? `Max. ${t.max_participants} Kinder pro Kurs`
            : "Plätze auf Anfrage"}
        </div>
        {t.starts_on && t.starts_on.slice(0, 10) < todayBerlinIso() && (
          <p className="pl-7 pt-1 text-sm font-medium text-primary-deep">
            Dieser Kurs läuft bereits. Bei späterem Einstieg reduziert sich der Kursbeitrag bei der
            Buchung automatisch um die schon stattgefundenen Termine.
          </p>
        )}
        {t.start_tentative && (
          <div className={NOTICE}>
            Voraussichtlicher Kursstart –{" "}
            {t.tentative_note || "Termin unter Vorbehalt, kann sich noch verschieben"}. Bei
            Verschiebung informieren wir alle Eltern; der Kursumfang bleibt erhalten.
          </div>
        )}
        {t.time_notice && <div className={NOTICE}>{t.time_notice}</div>}
        {(t.min_participants || t.lanes) && (
          <div className="text-xs text-muted-foreground pl-7">
            {t.lanes ? `${t.lanes} ${t.lanes === 1 ? "Bahn" : "Bahnen"}` : ""}
            {t.lanes && t.min_participants ? " · " : ""}
            {t.min_participants
              ? `Mindestens ${t.min_participants} Teilnehmende – sonst kann der Kurs vor Beginn abgesagt werden`
              : ""}
          </div>
        )}
        <div className="pl-7 pt-1">
          <TermStatusBadge term={t} />
        </div>
        {t.dates.length > 0 && <TermDates dates={t.dates} />}
      </div>
      <div className="shrink-0">
        {!t.is_full ? (
          <Button variant="accent" size="lg" onClick={onBook}>
            {bookLabel} <ChevronRight className="h-4 w-4" />
          </Button>
        ) : program.waitlist_open ? (
          <Button asChild variant="outline">
            <Link to="/warteliste" search={{ programm: program.slug }}>
              {LABELS.waitlistCta}
            </Link>
          </Button>
        ) : (
          <p className="text-sm font-medium text-muted-foreground">Ausgebucht</p>
        )}
      </div>
    </div>
  );
}
