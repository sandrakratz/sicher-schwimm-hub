import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Mail, Phone } from "lucide-react";
import { PhoneEditor } from "@/components/trainer/PhoneEditor";
import { ParticipantResultEditor, type ParticipantResult } from "@/components/trainer/ParticipantResultEditor";
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
  goal_reached?: boolean | null;
  badge?: string | null;
  achievement?: string | null;
  exam_level?: string | null;
  exam_criteria?: Record<string, { done?: boolean; value?: string | null }>;
  exam_date?: string | null;
  exam_pass_no?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Bestätigt",
  waiting: "Warteliste",
  cancelled: "Storniert",
};

/** Detailangaben zu einem Kind (Kontakt, Hinweise, Zahlung, Prüfungsnachweis). */
export function ParticipantDetails({
  p,
  showPayment = true,
  editablePhone = false,
  onPhoneSaved,
  editableResult = false,
  onResultSaved,
}: {
  p: ParticipantCardData;
  showPayment?: boolean;
  editablePhone?: boolean;
  onPhoneSaved?: (participantId: string, phone: string | null) => void;
  editableResult?: boolean;
  onResultSaved?: (participantId: string, result: ParticipantResult) => void;
}) {
  return (
    <div className="space-y-2 text-sm">
      <div className="text-xs text-muted-foreground">
        Geburtsdatum: {p.date_of_birth ? formatDateBerlin(p.date_of_birth) : "unbekannt"}
        {" · "}Status: {STATUS_LABEL[p.status] || p.status}
      </div>
      {editablePhone ? (
        <PhoneEditor participantId={p.id} phone={p.phone} onSaved={phone => onPhoneSaved?.(p.id, phone)} />
      ) : (
        p.phone && (
          <a href={`tel:${p.phone}`} className="flex min-h-11 items-center gap-2 text-primary">
            <Phone className="h-4 w-4" /> {p.phone}
          </a>
        )
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
      {editableResult && (
        <div className="border-t pt-3">
          <p className="mb-2 text-xs font-semibold">Prüfungsnachweis</p>
          <ParticipantResultEditor
            participantId={p.id}
            value={{
              goal_reached: p.goal_reached ?? null,
              badge: p.badge ?? null,
              achievement: p.achievement ?? null,
              exam_level: p.exam_level ?? null,
              exam_criteria: p.exam_criteria ?? {},
              exam_date: p.exam_date ?? null,
              exam_pass_no: p.exam_pass_no ?? null,
            }}
            onSaved={onResultSaved}
          />
        </div>
      )}
    </div>
  );
}

/** Kompakte Teilnehmer-Karte für kleine Displays. */
export function ParticipantCard({
  p,
  showPayment = true,
  no,
  editablePhone = false,
  onPhoneSaved,
  editableResult = false,
  onResultSaved,
}: {
  p: ParticipantCardData;
  showPayment?: boolean;
  no?: number | null;
  editablePhone?: boolean;
  onPhoneSaved?: (participantId: string, phone: string | null) => void;
  editableResult?: boolean;
  onResultSaved?: (participantId: string, result: ParticipantResult) => void;
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
        <div className="px-4 pb-4">
          <ParticipantDetails
            p={p}
            showPayment={showPayment}
            editablePhone={editablePhone}
            onPhoneSaved={onPhoneSaved}
            editableResult={editableResult}
            onResultSaved={onResultSaved}
          />
        </div>
      )}
    </div>
  );
}

export default ParticipantCard;
