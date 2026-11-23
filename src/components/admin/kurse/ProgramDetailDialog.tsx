import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { programFields } from "@/components/admin/kurse/ProgramFields";
import { TermList, type TermContext } from "@/components/admin/kurse/TermCard";
import type { Course, ProgramRow } from "@/components/admin/kurse/shared";
import type { ProgramEditor } from "@/components/admin/kurse/useProgramEditor";

/** Reiter „Kursangaben“: Angaben des Angebots, die für alle Zeiträume gelten. */
function ProgramDetailsForm({ editor, program }: { editor: ProgramEditor; program: ProgramRow }) {
  const { editing, setEditing } = editor;
  const f = programFields(editing, setEditing);
  return (
    <div className="space-y-3 border rounded-md p-4">
      <div>
        <div className="font-semibold text-sm">Kursangaben (gelten für alle Zeiträume)</div>
        <p className="text-xs text-muted-foreground mt-1">
          Diese Angaben steuern die öffentliche Darstellung: die Kurskarte in der Kursübersicht
          (/kurse) und die Detailseite (/kurse/
          {editing.slug || program.slug}). Kurszeiträume, Termine und Buchbarkeit werden im Reiter
          „Kurszeiträume" gepflegt.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {f.text("name")}
        {f.slug()}
      </div>
      {f.text("location")}
      {f.area("description", 3)}
      {f.area("requirements", 2)}
      {f.area("course_info", 6, "Treffpunkt, Ankunftszeit, was mitzubringen ist …")}
      <div className="grid sm:grid-cols-5 gap-3">
        {f.text("target_group")}
        {f.text("age_range")}
        {f.num("min_age_years")}
        {f.fit()}
        {f.num("max_age_years")}
        {f.text("duration")}
      </div>
      <div className="grid sm:grid-cols-4 gap-3 items-end">
        {f.num("price_non_member")}
        {f.num("price_member")}
        {f.num("payment_due_days")}
        {f.num("sort_order")}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {f.check(
          "is_public",
          "Auf der Webseite anzeigen",
          "(Karte in /kurse + eigene Detailseite)",
        )}
        {f.check("waitlist_open", "Warteliste aktiv", "(aus: keine neuen Wartelisten-Einträge)")}
        {f.check(
          "bookable",
          "Online buchbar",
          '(aus: Status „Geplant – noch nicht buchbar", keine Buchung)',
        )}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void editor.remove(program);
              editor.setDetailId(null);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" /> Kurs löschen
          </Button>
          <Button onClick={editor.save}>Kursangaben speichern</Button>
        </div>
      </div>
    </div>
  );
}

/** Detailansicht eines Kursangebots (oder der Zeiträume ohne Angebot). */
export function ProgramDetailDialog({
  editor,
  programs,
  termsOf,
  onNewTerm,
  ctx,
}: {
  editor: ProgramEditor;
  programs: ProgramRow[];
  termsOf: (programId: string | null) => Course[];
  onNewTerm: (p: ProgramRow | null) => void;
  ctx: TermContext;
}) {
  const { detailId, setDetailId } = editor;
  const unassigned = detailId === "unassigned";
  const program = detailId ? (programs.find((p) => p.id === detailId) ?? null) : null;
  const terms = <TermList terms={termsOf(unassigned ? null : detailId)} ctx={ctx} />;

  return (
    <Dialog open={detailId !== null} onOpenChange={(o) => !o && setDetailId(null)}>
      <DialogContent className="w-[95vw] max-w-[1100px] sm:max-w-[1100px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {unassigned ? "Zeiträume ohne Kursangebot" : program?.name || "Kurs"}
          </DialogTitle>
        </DialogHeader>

        {!unassigned && program ? (
          <Tabs defaultValue="zeitraeume">
            <TabsList>
              <TabsTrigger value="zeitraeume">Kurszeiträume</TabsTrigger>
              <TabsTrigger value="angaben">Kursangaben</TabsTrigger>
            </TabsList>

            <TabsContent value="zeitraeume" className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Termine, Plätze und Buchbarkeit je Zeitraum.
                </p>
                <Button size="sm" onClick={() => onNewTerm(program)}>
                  <Plus className="h-4 w-4" /> Neuer Zeitraum
                </Button>
              </div>
              {terms}
            </TabsContent>

            <TabsContent value="angaben" className="mt-4">
              <ProgramDetailsForm editor={editor} program={program} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-sm">Kurszeiträume</div>
              <Button size="sm" onClick={() => onNewTerm(unassigned ? null : program)}>
                <Plus className="h-4 w-4" /> Neuer Zeitraum
              </Button>
            </div>
            {terms}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setDetailId(null)}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
