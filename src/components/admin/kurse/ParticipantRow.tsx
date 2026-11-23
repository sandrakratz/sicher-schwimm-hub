import { ArrowRightLeft, Award, Lock, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { beltLabel } from "@/lib/belt";
import { combineChildHint } from "@/lib/child-hint";
import {
  ageAt,
  ENROLL_STATUS,
  fmtDate,
  type Course,
  type Participant,
} from "@/components/admin/kurse/shared";
import {
  isDeadBooking,
  paymentOf,
  type TransferConsent,
} from "@/components/admin/kurse/useParticipants";

const GREEN = "bg-green-600 hover:bg-green-700";

function ConsentBadge({ consent }: { consent: TransferConsent }) {
  return consent.status === "confirmed" ? (
    <Badge className={GREEN} title="Eltern haben der Umbuchung per E-Mail-Link zugestimmt">
      Umbuchung zugestimmt {fmtDate(consent.confirmed_at)}
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="border-amber-500 text-amber-700"
      title="Die Eltern haben den Link in der Umbuchungs-Mail noch nicht bestätigt"
    >
      Zustimmung Eltern offen
      {consent.reminded_at ? ` · erinnert ${fmtDate(consent.reminded_at)}` : ""}
    </Badge>
  );
}

function PaymentCell({
  p,
  course,
  onTogglePaid,
}: {
  p: Participant;
  course: Course | null;
  onTogglePaid: (paid: boolean) => void;
}) {
  if (isDeadBooking(p)) {
    return (
      <TableCell className="text-xs">
        <Badge variant="outline" className="text-muted-foreground">
          Abgesagt – keine Zahlung
        </Badge>
      </TableCell>
    );
  }
  const st = paymentOf(p, course);
  return (
    <TableCell className="text-xs">
      <label className="flex items-start gap-2 cursor-pointer">
        <Checkbox className="mt-0.5" checked={p.paid} onCheckedChange={(v) => onTogglePaid(!!v)} />
        <span>
          <Badge variant="outline" className={st.className}>
            {st.label}
          </Badge>
          <span className="block text-muted-foreground mt-0.5">{st.detail}</span>
        </span>
      </label>
    </TableCell>
  );
}

/** Eine Zeile der Teilnehmerliste mit Status, Zahlung und Aktionen. */
export function ParticipantRow({
  p,
  course,
  consent,
  parentName,
  health,
  onOpenRequest,
  onStatus,
  onTogglePaid,
  onEdit,
  onTransfer,
  onRemove,
}: {
  p: Participant;
  course: Course | null;
  consent: TransferConsent | undefined;
  parentName: string | null;
  health: string | null;
  onOpenRequest: (requestId: string) => void;
  onStatus: (status: Participant["status"]) => void;
  onTogglePaid: (paid: boolean) => void;
  onEdit: () => void;
  onTransfer: () => void;
  onRemove: () => void;
}) {
  const age = ageAt(p.date_of_birth, course?.starts_on);
  const hint = combineChildHint(p.notes, health);
  const hasAddress = p.payer_street || p.payer_zip || p.payer_city;
  const hasResult = p.goal_reached != null || p.badge || p.achievement || p.belt_blocks != null;
  return (
    <TableRow>
      <TableCell className="font-medium text-sm">
        {p.request_id ? (
          <button
            type="button"
            onClick={() => onOpenRequest(p.request_id!)}
            className="text-left text-primary underline underline-offset-2 hover:opacity-80"
            title="Kursanfrage anzeigen"
          >
            {p.participant_name || "—"}
          </button>
        ) : (
          <span title="Manuell angelegt (keine Kursanfrage)">{p.participant_name || "—"}</span>
        )}
        {consent && (
          <div className="mt-1">
            <ConsentBadge consent={consent} />
          </div>
        )}
      </TableCell>

      <TableCell className="text-xs">
        {p.date_of_birth ? (
          <>
            {fmtDate(p.date_of_birth)}
            {age != null && (
              <div className="text-muted-foreground">
                {age} J. {course?.starts_on ? "bei Kursbeginn" : "(heute)"}
              </div>
            )}
          </>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-xs">
        {parentName && (
          <div className="font-medium" title="Erziehungsberechtigte:r">
            {parentName}
          </div>
        )}
        {p.participant_email || "—"}
        {p.participant_phone && (
          <>
            <br />
            {p.participant_phone}
          </>
        )}
        {hasAddress && (
          <div className="mt-1 text-muted-foreground" title="Rechnungsanschrift der Eltern">
            {p.payer_street}
            <br />
            {[p.payer_zip, p.payer_city].filter(Boolean).join(" ")}
          </div>
        )}
      </TableCell>
      <TableCell>
        <Select value={p.status} onValueChange={(v) => onStatus(v as Participant["status"])}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENROLL_STATUS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-xs">
        {p.is_member === true && (
          <Badge
            className={p.member_confirmed ? GREEN : ""}
            variant={p.member_confirmed ? "default" : "outline"}
          >
            Mitglied{p.member_confirmed ? " ✓" : ""}
          </Badge>
        )}
        {p.is_member === false && <Badge variant="secondary">Nicht-Mitglied</Badge>}
        {p.is_member == null && <span className="text-muted-foreground">offen</span>}
        {p.price_amount != null && (
          <div className="text-muted-foreground mt-1">{Number(p.price_amount).toFixed(2)} €</div>
        )}
      </TableCell>

      <TableCell className="text-xs">
        {p.goal_reached === true && (
          <Badge className={GREEN}>
            <Award className="h-3 w-3 mr-1" />
            Ziel erreicht
          </Badge>
        )}
        {p.goal_reached === false && <Badge variant="secondary">Ziel offen</Badge>}
        {p.badge && <div className="mt-1">{p.badge}</div>}
        {p.achievement && (
          <div
            className="text-muted-foreground mt-0.5 max-w-[180px] truncate"
            title={p.achievement}
          >
            {p.achievement}
          </div>
        )}
        {p.belt_blocks != null && (
          <div className="mt-1 text-muted-foreground">Gurt: {beltLabel(p.belt_blocks)}</div>
        )}
        {!hasResult && "—"}
      </TableCell>
      <PaymentCell p={p} course={course} onTogglePaid={onTogglePaid} />
      <TableCell className="text-xs max-w-[220px]">
        {hint && (
          <div className="whitespace-pre-wrap rounded bg-amber-50 px-1 text-amber-900" title={hint}>
            {hint}
          </div>
        )}
        {p.internal_notes && (
          <div
            className="mt-0.5 flex items-center gap-1 truncate text-muted-foreground"
            title={p.internal_notes}
          >
            <Lock className="h-3 w-3 shrink-0" />
            {p.internal_notes}
          </div>
        )}
        {!hint && !p.internal_notes && "—"}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Teilnehmer bearbeiten"
          title="Teilnehmer bearbeiten"
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        {p.status !== "cancelled" && (
          <Button
            variant="ghost"
            size="sm"
            title="Kind umbuchen / Kurs wechseln"
            onClick={onTransfer}
          >
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          aria-label="Teilnehmer entfernen"
          title="Teilnehmer entfernen"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
