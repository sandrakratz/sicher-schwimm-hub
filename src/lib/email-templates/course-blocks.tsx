import * as React from "react";
import { Hr, Link, Section, Text } from "@react-email/components";
import { formatDateBerlin } from "@/lib/format";

export type MailSession = { date: string; start?: string | null; end?: string | null };

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function weekday(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return isNaN(d.getTime()) ? "" : WEEKDAYS[d.getUTCDay()]!;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function timeLabel(s: MailSession): string {
  if (!s.start) return "";
  const a = s.start.slice(0, 5);
  const b = s.end ? s.end.slice(0, 5) : "";
  return b ? `, ${a}–${b} Uhr` : `, ${a} Uhr`;
}

/** Alle Kurstermine einzeln, dazu ein Link zum Eintragen in den Kalender. Nichts, wenn noch keine Termine angelegt sind. */
export function SessionList({
  sessions,
  icsUrl,
}: {
  sessions?: MailSession[] | null;
  icsUrl?: string | null;
}) {
  if (!sessions || sessions.length === 0) return null;
  return (
    <Section style={{ marginTop: "16px" }}>
      <Text style={{ margin: "0 0 6px" }}>
        <strong>Ihre Kurstermine ({sessions.length})</strong>
      </Text>
      {sessions.map((s, i) => (
        <Text key={`${s.date}-${i}`} style={{ margin: "2px 0" }}>
          {i + 1}. Termin: {weekday(s.date)}, {formatDateBerlin(s.date)}
          {timeLabel(s)}
        </Text>
      ))}
      {icsUrl && (
        <Text style={{ margin: "10px 0 0", fontSize: "13px" }}>
          <Link href={icsUrl} style={{ color: "#0c4a6e" }}>
            Alle Termine in den Kalender eintragen
          </Link>{" "}
          (öffnet eine Kalenderdatei für Handy, Outlook oder Google-Kalender)
        </Text>
      )}
      <Text style={{ margin: "6px 0 0", fontSize: "12px", color: "#475569" }}>
        Fällt ein Termin aus, informieren wir Sie per E-Mail.
      </Text>
    </Section>
  );
}

/** „Absagen oder umbuchen“ – die Stufen aus den Kursbedingungen (Abschnitt 3) mit den konkreten Stichtagen. */
export function CancellationInfo({ startsOn, base }: { startsOn?: string | null; base: string }) {
  const freeUntil = startsOn ? formatDateBerlin(shiftDate(startsOn, -21)) : null;
  const halfFrom = startsOn ? formatDateBerlin(shiftDate(startsOn, -20)) : null;
  const halfUntil = startsOn ? formatDateBerlin(shiftDate(startsOn, -7)) : null;
  const fullFrom = startsOn ? formatDateBerlin(shiftDate(startsOn, -6)) : null;
  const row = { margin: "2px 0" } as const;
  return (
    <>
      <Hr />
      <Text style={{ margin: "12px 0 4px" }}>
        <strong>Kind kann nicht teilnehmen? Absagen oder umbuchen</strong>
      </Text>
      <Text style={row}>
        <strong>Kostenfrei</strong> bis 3 Wochen vor Kursbeginn
        {freeUntil ? ` (bis ${freeUntil})` : ""}.
      </Text>
      <Text style={row}>
        <strong>50 % der Kursgebühr</strong> bis 7 Tage vor Kursbeginn
        {halfFrom && halfUntil ? ` (${halfFrom} bis ${halfUntil})` : ""}.
      </Text>
      <Text style={row}>
        <strong>100 % der Kursgebühr</strong> danach{fullFrom ? ` (ab ${fullFrom})` : ""}.
      </Text>
      <Text style={{ margin: "8px 0 0" }}>
        Schreiben Sie uns dafür einfach eine E-Mail an{" "}
        <Link href="mailto:kurse@sicher-schwimmen.com" style={{ color: "#0c4a6e" }}>
          kurse@sicher-schwimmen.com
        </Link>
        ; maßgeblich ist der Eingang bei uns. Ein Wechsel in einen anderen Kurs zählt als Rücktritt
        mit Neuanmeldung (bei freiem Platz). Bei ärztlich attestierter Krankheit entscheidet der
        Vorstand im Einzelfall – melden Sie sich bitte rechtzeitig. Alle Einzelheiten:{" "}
        <Link href={`${base}/kursbedingungen`} style={{ color: "#0c4a6e" }}>
          Kursteilnahmebedingungen
        </Link>
        .
      </Text>
    </>
  );
}
