import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Phone, Mail } from "lucide-react";
import { formatDateBerlin } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ParticipantCardData = {
  id: string;
  name: string | null;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: string;
  paid?: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Bestätigt",
  waiting: "Warteliste",
  cancelled: "Storniert",
};

/** Kompakte Teilnehmer-Karte für kleine Displays. */
export function ParticipantCard({
  p,
  showPayment = true,
  no,
}: {
  p: ParticipantCardData;
  showPayment?: boolean;
  no?: number | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center truncate text-sm font-semibold">
            {no ? (
              <span className="mr-2 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded border px-1 text-[11px] font-semibold text-muted-foreground">
                {no}
              </span>
            ) : null}
            <span className="truncate">{p.name || "—"}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {p.date_of_birth ? formatDateBerlin(p.date_of_birth) : "Geburtsdatum unbekannt"}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary">{STATUS_LABEL[p.status] || p.status}</Badge>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="space-y-2 px-4 pb-4 text-sm">
          {p.phone && (
            <a href={`tel:${p.phone}`} className="flex min-h-11 items-center gap-2 text-primary">
              <Phone className="h-4 w-4" /> {p.phone}
            </a>
          )}
          {p.email && (
            <a href={`mailto:${p.email}`} className="flex min-h-11 items-center gap-2 break-all text-primary">
              <Mail className="h-4 w-4 shrink-0" /> {p.email}
            </a>
          )}
          {p.notes && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{p.notes}</p>}
          {showPayment && (
            <div>
              {p.paid ? (
                <Badge className="border-transparent bg-green-600 text-white">bezahlt</Badge>
              ) : (
                <Badge className="border-transparent bg-amber-100 text-amber-900">offen</Badge>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ParticipantCard;
