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
import { Textarea } from "@/components/ui/textarea";
import { ProgramFitFields } from "@/components/admin/ProgramFitFields";
import { Hint, slugify, type ProgramRow } from "@/components/admin/kurse/shared";

/** Dialog „Kursangebot bearbeiten / neu“ der Kursverwaltung. */
export function ProgramDialog({
  open,
  onOpenChange,
  editing,
  setEditing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Partial<ProgramRow>;
  setEditing: Dispatch<SetStateAction<Partial<ProgramRow>>>;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing.id ? "Kursangebot bearbeiten" : "Neues Kursangebot"}</DialogTitle>
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
              <Label>Slug (URL)</Label>
              <Input
                value={editing.slug || ""}
                onChange={(e) => setEditing((p) => ({ ...p, slug: e.target.value }))}
              />
              <Hint>
                Adresse der Detailseite: /kurse/{editing.slug || "…"} – nachträgliches Ändern
                verändert bestehende Links.
              </Hint>
            </div>
          </div>
          <div>
            <Label>Beschreibung</Label>
            <Textarea
              rows={3}
              value={editing.description || ""}
              onChange={(e) => setEditing((p) => ({ ...p, description: e.target.value }))}
            />
            <Hint>
              Erster Absatz = Kurztext in der Kursübersicht /kurse und Einleitung oben auf der
              Detailseite. Weitere Absätze (durch Leerzeile trennen) erscheinen nur auf der
              Detailseite.
            </Hint>
          </div>
          <div>
            <Label>Voraussetzungen</Label>
            <Textarea
              rows={2}
              value={editing.requirements || ""}
              onChange={(e) => setEditing((p) => ({ ...p, requirements: e.target.value }))}
            />
            <Hint>
              Kursübersicht: kurz unter „Voraussetzungen" bzw. bei geplanten Angeboten als „Rahmen".
              Detailseite: eigener Abschnitt. Jede Zeile wird zu einem Aufzählungspunkt.
            </Hint>
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
              Standardtext für neue Zeiträume dieses Angebots. Wird auf der Detailseite, in der
              Buchungsbestätigung und in der Erinnerungs-E-Mail gezeigt.
            </Hint>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Zielgruppe</Label>
              <Input
                value={editing.target_group || ""}
                onChange={(e) => setEditing((p) => ({ ...p, target_group: e.target.value }))}
              />
              <Hint>Badge oben auf der Kurskarte und in der Infobox der Detailseite.</Hint>
            </div>
            <div>
              <Label>Altersangabe</Label>
              <Input
                value={editing.age_range || ""}
                onChange={(e) => setEditing((p) => ({ ...p, age_range: e.target.value }))}
              />
              <Hint>
                Blaue Zeile unter dem Kursnamen (Kursübersicht) und Infobox (Detailseite).
              </Hint>
            </div>
            <div>
              <Label>Mindestalter (Jahre)</Label>
              <Input
                type="number"
                value={editing.min_age_years ?? ""}
                onChange={(e) =>
                  setEditing((p) => ({
                    ...p,
                    min_age_years: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
              <Hint>
                Nur Detailseite (Hinweis bei den Voraussetzungen) und Prüfung bei Buchung und
                Warteliste.
              </Hint>
            </div>
            <ProgramFitFields
              minSwimLevel={editing.min_swim_level}
              weekday={editing.weekday}
              onChange={(v) => setEditing((p) => ({ ...p, ...v }))}
            />
            <div>
              <Label>Höchstalter (Jahre)</Label>
              <Input
                type="number"
                value={editing.max_age_years ?? ""}
                onChange={(e) =>
                  setEditing((p) => ({
                    ...p,
                    max_age_years: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
              <Hint>
                Bis einschließlich (z. B. 5 = am 6. Geburtstag nicht mehr). Leer = keine Obergrenze.
              </Hint>
            </div>
            <div>
              <Label>Dauer</Label>
              <Input
                value={editing.duration || ""}
                onChange={(e) => setEditing((p) => ({ ...p, duration: e.target.value }))}
              />
              <Hint>
                Uhr-Zeile auf Kurskarte und Detailseite (z. B. „8 Termine · ca. 40 Minuten").
              </Hint>
            </div>
          </div>
          <div>
            <Label>Ort</Label>
            <Input
              value={editing.location || ""}
              onChange={(e) => setEditing((p) => ({ ...p, location: e.target.value }))}
            />
            <Hint>
              Ortszeile auf Kurskarte und Detailseite. Einzelne Zeiträume können unten einen
              abweichenden Ort haben.
            </Hint>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Preis Nicht-Mitglied (€)</Label>
              <Input
                type="number"
                value={editing.price_non_member ?? ""}
                onChange={(e) =>
                  setEditing((p) => ({
                    ...p,
                    price_non_member: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
              <Hint>Preiszeile auf Kurskarte und Detailseite.</Hint>
            </div>
            <div>
              <Label>Preis Mitglied (€)</Label>
              <Input
                type="number"
                value={editing.price_member ?? ""}
                onChange={(e) =>
                  setEditing((p) => ({
                    ...p,
                    price_member: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
              <Hint>Preiszeile auf Kurskarte und Detailseite.</Hint>
            </div>
            <div>
              <Label>Zahlungsziel (Tage)</Label>
              <Input
                type="number"
                value={editing.payment_due_days ?? 14}
                onChange={(e) =>
                  setEditing((p) => ({ ...p, payment_due_days: Number(e.target.value) }))
                }
              />
              <Hint>
                Nicht öffentlich sichtbar – wird in Buchungsbestätigung und Rechnungstext genutzt.
              </Hint>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <Label>Sortierung</Label>
              <Input
                type="number"
                value={editing.sort_order ?? 0}
                onChange={(e) => setEditing((p) => ({ ...p, sort_order: Number(e.target.value) }))}
              />
              <Hint>Reihenfolge der Karten in der Kursübersicht (kleine Zahl zuerst).</Hint>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={editing.is_public ?? true}
                onCheckedChange={(v) => setEditing((p) => ({ ...p, is_public: Boolean(v) }))}
              />
              Auf der Webseite anzeigen
              <span className="text-[11px] text-muted-foreground">
                (Karte in /kurse + Detailseite)
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={(editing as any).waitlist_open ?? true}
                onCheckedChange={(v) =>
                  setEditing((p) => ({ ...p, waitlist_open: Boolean(v) }) as any)
                }
              />
              Warteliste aktiv
              <span className="text-[11px] text-muted-foreground">
                (aus: keine neuen Wartelisten-Einträge)
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={editing.bookable ?? true}
                onCheckedChange={(v) => setEditing((p) => ({ ...p, bookable: Boolean(v) }))}
              />
              Online buchbar
              <span className="text-[11px] text-muted-foreground">
                (aus: „Geplant – noch nicht buchbar")
              </span>
            </label>
          </div>
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
