import { Link } from "@tanstack/react-router";
import { Check, Pencil, Undo2 } from "lucide-react";
import { MoreMenu } from "@/components/admin/MoreMenu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateBerlin, formatEuro } from "@/lib/format";
import { isDeadBooking, paymentOf } from "@/components/admin/kurse/useParticipants";
import { ParticipantActionDialogs } from "@/components/admin/kurse/useParticipantActions";
import type { FamilyBookingsState } from "./useFamilyBookings";

const STATUS: Record<string, string> = {
  confirmed: "Gebucht",
  waiting: "Warteliste",
  cancelled: "Abgesagt / storniert",
};

/**
 * Buchungen einer Familie mit denselben Aktionen wie in der Teilnehmerliste eines Kurses:
 * bezahlt, bearbeiten, umbuchen, Absage erfassen, entfernen. Die Daten kommen aus
 * `useFamilyBookings` (einmal je Seite, damit auch die Kind-Karten sie nutzen).
 */
export function FamilyBookings({ fb }: { fb: FamilyBookingsState }) {
  const { rows, courses, targets, requestHealth, requestParent, a, editCourse } = fb;

  if (!rows) return <p className="text-sm text-muted-foreground">Wird geladen …</p>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Keine Buchungen.</p>;

  return (
    <>
      <div className="divide-y rounded-md border bg-card">
        {rows.map((p) => {
          const c = courses.get(p.course_id) ?? null;
          const pay = paymentOf(p, c);
          const dead = isDeadBooking(p);
          const active = p.status === "confirmed";
          return (
            <div key={p.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{p.participant_name ?? "–"}</span>
                  <Badge variant="secondary" title={p.cancel_reason ?? undefined}>
                    {p.removed_at ? "Aus dem Kurs genommen" : (STATUS[p.status] ?? p.status)}
                  </Badge>
                  {!dead && (
                    <Badge variant="outline" className={pay.className}>
                      {pay.label}
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  <Link
                    to="/admin/kurs/$courseId"
                    params={{ courseId: p.course_id }}
                    className="text-primary underline underline-offset-2"
                    title="Kurs mit allen Teilnehmern öffnen"
                  >
                    {c?.name ?? "Kurs"}
                  </Link>
                  {c?.starts_on &&
                    ` · ${formatDateBerlin(c.starts_on)}${c.ends_on && c.ends_on !== c.starts_on ? ` – ${formatDateBerlin(c.ends_on)}` : ""}`}
                  {p.price_amount != null && ` · ${formatEuro(p.price_amount)}`}
                  {` · gebucht ${formatDateBerlin(p.created_at)}`}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {!dead &&
                  (p.paid ? (
                    <Button size="sm" variant="ghost" onClick={() => void a.togglePaid(p, false)}>
                      <Undo2 className="h-4 w-4" aria-hidden="true" /> Zahlung zurücksetzen
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => void a.togglePaid(p, true)}>
                      <Check className="h-4 w-4" aria-hidden="true" /> Bezahlt
                    </Button>
                  ))}
                <Button size="sm" variant="outline" onClick={() => a.setEditPart(p)}>
                  <Pencil className="h-4 w-4" aria-hidden="true" /> Bearbeiten
                </Button>
                {active && (
                  <MoreMenu
                    items={[
                      {
                        label: "Umbuchen …",
                        hint: "Anderer Kurs; Gebühr nach § 3, Eltern stimmen per Link zu",
                        onSelect: () => a.setTransferPart(p),
                      },
                      {
                        label: "Absage erfassen …",
                        hint: "Familie sagt ab – zählt als Absage, Platz wird frei",
                        onSelect: () => void a.updateStatus(p, "cancelled"),
                      },
                      {
                        label: "Wieder auf die Warteliste …",
                        hint: "Platz wird frei, Kind wartet wieder – zählt nicht als Absage",
                        onSelect: () => void a.updateStatus(p, "waiting"),
                      },
                      {
                        label: "Aus dem Kurs nehmen …",
                        hint: "Durch den Verein, z. B. Nichtzahlung – Buchung bleibt mit Grund sichtbar",
                        onSelect: () => a.startRemove(p),
                      },
                    ]}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ParticipantActionDialogs
        a={a}
        editCourse={editCourse}
        transferCourses={targets}
        requestHealth={requestHealth}
        requestParent={requestParent}
      />
    </>
  );
}
