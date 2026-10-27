import { Badge } from "@/components/ui/badge";
import type { FamilyEvent } from "@/lib/family.functions";
import { formatDateTimeBerlin } from "@/lib/format";

const EVENT_STYLE: Record<FamilyEvent["kind"], string> = {
  request: "bg-slate-100 text-slate-800",
  waitlist: "bg-amber-100 text-amber-900",
  booking: "bg-emerald-100 text-emerald-900",
  payment: "bg-emerald-100 text-emerald-900",
  cancel: "bg-red-100 text-red-900",
  mail: "bg-sky-100 text-sky-900",
  block: "bg-red-100 text-red-900",
  note: "bg-muted text-foreground",
};
const EVENT_LABEL: Record<FamilyEvent["kind"], string> = {
  request: "Anfrage",
  waitlist: "Anfrageliste",
  booking: "Buchung",
  payment: "Zahlung",
  cancel: "Absage",
  mail: "E-Mail",
  block: "Sperrliste",
  note: "Notiz",
};

/** Zeitleiste einer Familie (Anfragen, Buchungen, Zahlungen, Absagen, E-Mails …). */
export function FamilyTimeline({ events }: { events: FamilyEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Ereignisse.</p>;
  }
  return (
    <ol className="space-y-3">
      {events.map((ev, i) => (
        <li key={i} className="grid grid-cols-[9.5rem_6.5rem_1fr] items-start gap-3 text-sm">
          <span className="text-muted-foreground">
            {ev.whenLabel ?? formatDateTimeBerlin(ev.at)}
          </span>
          <Badge variant="secondary" className={`justify-center ${EVENT_STYLE[ev.kind]}`}>
            {EVENT_LABEL[ev.kind]}
          </Badge>
          <span>
            <span className="font-medium">{ev.title}</span>
            {ev.detail && (
              <span className="block whitespace-pre-wrap text-muted-foreground">{ev.detail}</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
