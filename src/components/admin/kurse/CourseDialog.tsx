import type { Dispatch, SetStateAction } from "react";
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
import { formatDateBerlin } from "@/lib/format";
import { paymentTerms } from "@/lib/payment-status";
import { parseSessionList } from "@/lib/session-list";
import {
  Hint,
  STATUS_OPTIONS,
  slugify,
  type Course,
  type ProgramRow,
} from "@/components/admin/kurse/shared";

/** Dialog „Kurs anlegen / bearbeiten“ der Kursverwaltung. */
export function CourseDialog({
  open,
  onOpenChange,
  editing,
  setEditing,
  programs,
  sessionText,
  setSessionText,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Partial<Course>;
  setEditing: Dispatch<SetStateAction<Partial<Course>>>;
  programs: ProgramRow[];
  sessionText: string;
  setSessionText: (text: string) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing.id ? "Kurs bearbeiten" : "Neuer Kurs"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={editing.name || ""}
                onChange={(e) =>
                  setEditing((p) => ({
                    ...p,
                    name: e.target.value,
                    slug: p.slug || slugify(e.target.value),
                  }))
                }
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                value={editing.slug || ""}
                onChange={(e) => setEditing((p) => ({ ...p, slug: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Kursangebot (für die Webseite)</Label>
            <Select
              value={editing.program_id || "none"}
              onValueChange={(v) =>
                setEditing((p) => ({ ...p, program_id: v === "none" ? null : v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Kein Kursangebot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kein Kursangebot (nur intern)</SelectItem>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Zugeordnete Zeiträume erscheinen auf der Webseite unter dem Kursangebot und können
              dort gebucht werden.
            </p>
          </div>

          <div>
            <Label>Beschreibung</Label>
            <Textarea
              rows={3}
              value={editing.description || ""}
              onChange={(e) => setEditing((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Zielgruppe</Label>
              <Input
                value={editing.target_group || ""}
                onChange={(e) => setEditing((p) => ({ ...p, target_group: e.target.value }))}
              />
            </div>
            <div>
              <Label>Altersgruppe</Label>
              <Input
                value={editing.age_range || ""}
                onChange={(e) => setEditing((p) => ({ ...p, age_range: e.target.value }))}
              />
            </div>
            <div>
              <Label>Dauer</Label>
              <Input
                value={editing.duration || ""}
                onChange={(e) => setEditing((p) => ({ ...p, duration: e.target.value }))}
                placeholder="z.B. 10 Wochen"
              />
            </div>
            <div>
              <Label>Ort</Label>
              <Input
                value={editing.location || ""}
                onChange={(e) => setEditing((p) => ({ ...p, location: e.target.value }))}
              />
            </div>
            <div>
              <Label>Start</Label>
              <Input
                type="date"
                value={editing.starts_on || ""}
                onChange={(e) => setEditing((p) => ({ ...p, starts_on: e.target.value || null }))}
              />
            </div>
            <div>
              <Label>Ende</Label>
              <Input
                type="date"
                value={editing.ends_on || ""}
                onChange={(e) => setEditing((p) => ({ ...p, ends_on: e.target.value || null }))}
              />
            </div>
            <div>
              <Label>Max. Plätze</Label>
              <Input
                type="number"
                value={editing.max_participants ?? ""}
                onChange={(e) =>
                  setEditing((p) => ({
                    ...p,
                    max_participants: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              />
            </div>
            <div>
              <Label>Mindestteilnehmerzahl</Label>
              <Input
                type="number"
                value={editing.min_participants ?? ""}
                onChange={(e) =>
                  setEditing((p) => ({
                    ...p,
                    min_participants: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                placeholder="z.B. 14"
              />
            </div>
            <div>
              <Label>Bahnen</Label>
              <Select
                value={editing.lanes ? String(editing.lanes) : "none"}
                onValueChange={(v) =>
                  setEditing((p) => ({ ...p, lanes: v === "none" ? null : Number(v) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Angabe</SelectItem>
                  <SelectItem value="1">1 Bahn</SelectItem>
                  <SelectItem value="2">2 Bahnen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Benötigte Trainer:innen pro Termin</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={editing.trainers_needed ?? 2}
                onChange={(e) =>
                  setEditing((p) => ({
                    ...p,
                    trainers_needed: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              />
              <Hint>Maßgeblich für Dienstplan und Kurskalender (Ampel „unterbesetzt“).</Hint>
            </div>
            <div>
              <Label>Anzahl der Einheiten</Label>
              <Input
                type="number"
                value={editing.unit_count ?? ""}
                onChange={(e) =>
                  setEditing((p) => ({
                    ...p,
                    unit_count: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                placeholder="z.B. 12"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={editing.status}
                onValueChange={(v: any) => setEditing((p) => ({ ...p, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
            <Label className="text-sm font-semibold">
              Terminliste einfügen (z. B. aus der KI kopiert)
            </Label>
            <p className="text-xs text-muted-foreground">
              Eine Zeile pro Termin, Uhrzeit optional. Pausen mit „—“ oder „kein Termin“ markieren.
              Beim Speichern werden Start, Ende, Anzahl der Einheiten und alle Termine übernommen –
              Eltern sehen sie auf der Kursseite.
              {editing.id ? " Vorhandene Termine werden ersetzt." : ""} Leer lassen, um nichts zu
              ändern.
            </p>
            <Textarea
              rows={6}
              value={sessionText}
              onChange={(e) => setSessionText(e.target.value)}
              placeholder={
                "1  07.11.2026  11:00–11:45 Uhr\n2  14.11.2026  11:00–11:45 Uhr\n—  26.12.2026  kein Termin – Weihnachtspause\n3  09.01.2027  11:00–11:45 Uhr"
              }
            />
            {sessionText.trim() &&
              (() => {
                const p = parseSessionList(sessionText);
                const r = p.filter((x) => !x.isBreak);
                return (
                  <p className="text-xs text-muted-foreground">
                    Erkannt: {r.length} Termine, {p.length - r.length} Pausen
                    {r.length
                      ? ` · ${formatDateBerlin(r[0].date)} – ${formatDateBerlin(r[r.length - 1].date)}`
                      : ""}
                  </p>
                );
              })()}
          </div>
          <div className="rounded-md border p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!editing.start_tentative}
                onCheckedChange={(v) => setEditing((p) => ({ ...p, start_tentative: !!v }))}
              />{" "}
              Starttermin unter Vorbehalt (z. B. Wiedereröffnung / Sanierung)
            </label>
            {editing.start_tentative && (
              <>
                <Input
                  value={editing.tentative_note || ""}
                  onChange={(e) => setEditing((p) => ({ ...p, tentative_note: e.target.value }))}
                  placeholder="vorbehaltlich der Wiedereröffnung der Sportschule Hennef"
                />
                <Hint>
                  Wird bei Kursbeginn auf der Webseite angezeigt. Buchung und Zahlungsfrist laufen
                  normal.
                </Hint>
              </>
            )}
          </div>
          <div>
            <Label>Ablauf & Wichtiges für den Kurstag</Label>
            <Textarea
              rows={6}
              value={editing.course_info || ""}
              onChange={(e) => setEditing((p) => ({ ...p, course_info: e.target.value }))}
              placeholder={"Treffpunkt, Ankunftszeit, was mitzubringen ist …"}
            />
            <Hint>
              Erscheint auf der Kursdetailseite, in der Buchungsbestätigung und in der
              Erinnerungs-E-Mail 3 Tage vor Kursstart. Absätze und Zeilen bleiben erhalten.
            </Hint>
          </div>
          <div>
            <Label>Zeitplan</Label>
            <Input
              value={editing.schedule || ""}
              onChange={(e) => setEditing((p) => ({ ...p, schedule: e.target.value }))}
              placeholder="z.B. Mo & Mi 17:00–18:00"
            />
          </div>
          <div className="grid grid-cols-3 gap-3 border-t pt-3">
            <div>
              <Label>Preis Mitglied (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={editing.price_member ?? ""}
                onChange={(e) =>
                  setEditing((p) => ({
                    ...p,
                    price_member: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                placeholder="150"
              />
            </div>
            <div>
              <Label>Preis Nicht-Mitglied (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={editing.price_non_member ?? ""}
                onChange={(e) =>
                  setEditing((p) => ({
                    ...p,
                    price_non_member: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                placeholder="200"
              />
            </div>
            <div>
              <Label>Zahlungsfrist (Tage)</Label>
              <Input
                type="number"
                value={editing.payment_due_days ?? 14}
                onChange={(e) =>
                  setEditing((p) => ({
                    ...p,
                    payment_due_days: e.target.value ? Number(e.target.value) : 14,
                  }))
                }
              />
            </div>
          </div>
          {editing.starts_on &&
            (() => {
              const terms = paymentTerms({
                startsOn: editing.starts_on,
                paymentDueDays: editing.payment_due_days ?? 14,
              });
              return (
                <div className="rounded-md border bg-muted/40 p-3 text-xs">
                  <div className="font-medium">Zahlungsvorschau bei Buchung heute</div>
                  <div className="mt-1 text-muted-foreground">
                    Kursbeginn {formatDateBerlin(editing.starts_on)} · Zahlungsart:{" "}
                    {terms.methodLabel} · fällig bis {terms.dueDateLabel}
                  </div>
                  <div className="mt-1 text-muted-foreground">{terms.note}</div>
                </div>
              );
            })()}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={editing.is_public ?? true}
              onCheckedChange={(v) => setEditing((p) => ({ ...p, is_public: !!v }))}
            />{" "}
            Öffentlich sichtbar
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={onSave}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
