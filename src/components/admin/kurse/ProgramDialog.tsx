import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { programFields } from "@/components/admin/kurse/ProgramFields";
import { slugify, type ProgramRow } from "@/components/admin/kurse/shared";

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
  const f = programFields(editing, setEditing);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing.id ? "Kursangebot bearbeiten" : "Neues Kursangebot"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {f.text("name", undefined, (name) =>
              // Neuer Name schlägt die Adresse vor, solange noch keine vergeben ist
              setEditing((p) => ({ ...p, name, slug: p.slug || slugify(name) })),
            )}
            {f.slug()}
          </div>
          {f.area("description", 3)}
          {f.area("requirements", 2)}
          {f.area("course_info", 6, "Treffpunkt, Ankunftszeit, was mitzubringen ist …")}
          <div className="grid grid-cols-2 gap-3">
            {f.text("target_group")}
            {f.text("age_range")}
            {f.num("min_age_years")}
            {f.fit()}
            {f.num(
              "max_age_years",
              "Bis einschließlich (z. B. 5 = am 6. Geburtstag nicht mehr). Leer = keine Obergrenze.",
            )}
            {f.text("duration")}
          </div>
          {f.text(
            "location",
            "Ortszeile auf Kurskarte und Detailseite. Einzelne Zeiträume können unten einen abweichenden Ort haben.",
          )}
          <div className="grid grid-cols-3 gap-3">
            {f.num("price_non_member")}
            {f.num("price_member")}
            {f.num("payment_due_days")}
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            {f.num("sort_order")}
            {f.check("is_public", "Auf der Webseite anzeigen", "(Karte in /kurse + Detailseite)")}
            {f.check(
              "waitlist_open",
              "Warteliste aktiv",
              "(aus: keine neuen Wartelisten-Einträge)",
            )}
            {f.check("bookable", "Online buchbar", '(aus: „Geplant – noch nicht buchbar")')}
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
