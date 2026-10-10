import type { Dispatch, SetStateAction } from "react";
import { combineChildHint } from "@/lib/child-hint";
import { Award, Euro, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ENROLL_STATUS,
  ageAt,
  fmtDate,
  type Course,
  type Participant,
} from "@/components/admin/kurse/shared";

/** Teilnehmer einer Buchung bearbeiten (Stammdaten, Zahlung, Mitgliedschaft, Preis). */
export function EditParticipantDialog({
  editPart,
  setEditPart,
  course,
  canManage,
  requestHealth,
  onSave,
}: {
  editPart: Participant | null;
  setEditPart: Dispatch<SetStateAction<Participant | null>>;
  course: Course | null;
  canManage: boolean;
  requestHealth: Record<string, string | null>;
  onSave: () => void;
}) {
  return (
    <Dialog open={!!editPart} onOpenChange={(v) => !v && setEditPart(null)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Teilnehmer bearbeiten</DialogTitle>
        </DialogHeader>
        {editPart && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name *</Label>
                <Input
                  value={editPart.participant_name || ""}
                  onChange={(e) =>
                    setEditPart((p) => p && { ...p, participant_name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Geburtsdatum</Label>
                <Input
                  type="date"
                  value={editPart.date_of_birth || ""}
                  onChange={(e) => setEditPart((p) => p && { ...p, date_of_birth: e.target.value })}
                />
                {editPart.date_of_birth &&
                  (() => {
                    const a = ageAt(editPart.date_of_birth, course?.starts_on);
                    return a != null ? (
                      <div className="text-xs text-muted-foreground mt-1">
                        {a} Jahre {course?.starts_on ? "bei Kursbeginn" : "(heute)"}
                      </div>
                    ) : null;
                  })()}
              </div>
              <div>
                <Label>E-Mail</Label>
                <Input
                  type="email"
                  value={editPart.participant_email || ""}
                  onChange={(e) =>
                    setEditPart((p) => p && { ...p, participant_email: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Telefon</Label>
                <Input
                  value={editPart.participant_phone || ""}
                  onChange={(e) =>
                    setEditPart((p) => p && { ...p, participant_phone: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={editPart.status}
                  onValueChange={(v: any) => setEditPart((p) => p && { ...p, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  {/* „Warteliste“ gibt es nur über die Wartelisten-Funktionen (Status-Auswahl in der Teilnehmerliste) */}
                  <SelectContent>
                    {ENROLL_STATUS.filter(
                      (o) => o.value !== "waiting" || editPart.status === "waiting",
                    ).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(() => {
              const fromRequest = (
                editPart.request_id ? (requestHealth[editPart.request_id] ?? "") : ""
              ).trim();
              if (!fromRequest || (editPart.notes ?? "").includes(fromRequest)) return null;
              return (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm">
                  <div className="text-xs font-medium text-amber-900">
                    Gesundheitshinweise aus der Anmeldung
                  </div>
                  <div className="whitespace-pre-wrap">{fromRequest}</div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() =>
                      setEditPart(
                        (p) =>
                          p && { ...p, notes: combineChildHint(p.notes, fromRequest) ?? p.notes },
                      )
                    }
                  >
                    In den Hinweis zum Kind übernehmen
                  </Button>
                </div>
              );
            })()}
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2">
              <Label>Wichtiger Hinweis zum Kind (für Trainer sichtbar)</Label>
              <Textarea
                rows={2}
                placeholder="Gesundheit, Ängste, Besonderheiten …"
                value={editPart.notes || ""}
                onChange={(e) => setEditPart((p) => p && { ...p, notes: e.target.value })}
              />
            </div>
            {canManage && (
              <div className="rounded-md border bg-muted/40 p-2">
                <Label className="flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Interne Notiz (nur Vorstand – Trainer sehen das nicht)
                </Label>
                <Textarea
                  rows={2}
                  placeholder="Zahlungsabsprache, Geschwisterkind, Umbuchung …"
                  value={editPart.internal_notes || ""}
                  onChange={(e) =>
                    setEditPart((p) => p && { ...p, internal_notes: e.target.value })
                  }
                />
              </div>
            )}

            {canManage && (
              <div className="border-t pt-3 mt-2">
                <div className="font-semibold text-sm mb-2">Mitgliedschaft & Preis</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Mitglied?</Label>
                    <Select
                      value={
                        editPart.is_member == null ? "unset" : editPart.is_member ? "yes" : "no"
                      }
                      onValueChange={(v) =>
                        setEditPart((p) => {
                          if (!p) return p;
                          const next = v === "unset" ? null : v === "yes";
                          // Preis mitziehen, solange er noch dem Standardpreis der bisherigen Stufe entspricht (oder leer ist)
                          const memberPrice = course?.price_member ?? null;
                          const nonMemberPrice = course?.price_non_member ?? null;
                          const cur = p.price_amount == null ? null : Number(p.price_amount);
                          const isStandard =
                            cur == null || cur === memberPrice || cur === nonMemberPrice;
                          let price = p.price_amount;
                          if (isStandard && next === true && memberPrice != null)
                            price = memberPrice;
                          if (isStandard && next === false && nonMemberPrice != null)
                            price = nonMemberPrice;
                          return { ...p, is_member: next, price_amount: price };
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unset">— Unklar —</SelectItem>
                        <SelectItem value="yes">Ja</SelectItem>
                        <SelectItem value="no">Nein</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Kursgebühr (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editPart.price_amount ?? ""}
                      onChange={(e) =>
                        setEditPart(
                          (p) =>
                            p && {
                              ...p,
                              price_amount: e.target.value ? Number(e.target.value) : null,
                            },
                        )
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={editPart.member_confirmed}
                        onCheckedChange={(v) =>
                          setEditPart((p) => p && { ...p, member_confirmed: !!v })
                        }
                      />
                      Mitgliedschaft bestätigt (Buchhaltung)
                    </label>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Elternkonto-Verknüpfung:{" "}
                  {editPart.parent_user_id ? (
                    <span className="font-mono">{editPart.parent_user_id}</span>
                  ) : (
                    "noch nicht verknüpft (wird automatisch bei Registrierung der Eltern-E-Mail gesetzt)"
                  )}
                </div>
              </div>
            )}

            <div className="border-t pt-3 mt-2">
              <div className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Award className="h-4 w-4" /> Kursergebnis
              </div>
              <div className="text-sm space-y-1">
                <div>
                  <span className="text-muted-foreground">Kursziel: </span>
                  {editPart.goal_reached === true
                    ? "erreicht"
                    : editPart.goal_reached === false
                      ? "nicht erreicht"
                      : "offen"}
                </div>
                <div>
                  <span className="text-muted-foreground">Abzeichen: </span>
                  {editPart.badge || "—"}
                </div>
                <div className="whitespace-pre-wrap">
                  <span className="text-muted-foreground">Geschafft / Anmerkungen: </span>
                  {editPart.achievement || "—"}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Das Kursergebnis wird von den Trainer:innen vor Ort im Trainerbereich unter „Meine
                Kurse“ erfasst.
              </p>
            </div>

            {canManage && (
              <div className="border-t pt-3 mt-2">
                <div className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Euro className="h-4 w-4" /> Zahlung (Buchhaltung)
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={editPart.paid}
                    onCheckedChange={(v) =>
                      setEditPart(
                        (p) =>
                          p && {
                            ...p,
                            paid: !!v,
                            paid_at: v ? p.paid_at || new Date().toISOString() : null,
                          },
                      )
                    }
                  />
                  Kursgebühr bezahlt
                </label>
                {editPart.paid && editPart.paid_at && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Bestätigt am {fmtDate(editPart.paid_at)}
                  </div>
                )}
                <div className="mt-3">
                  <Label>Zahlungsnotiz</Label>
                  <Textarea
                    rows={2}
                    placeholder="z.B. Überweisung, Bar, Rechnungsnr. …"
                    value={editPart.payment_note || ""}
                    onChange={(e) =>
                      setEditPart((p) => p && { ...p, payment_note: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditPart(null)}>
            Abbrechen
          </Button>
          <Button onClick={onSave}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
