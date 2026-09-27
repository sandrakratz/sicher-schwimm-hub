import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cancelCourse, rescheduleCourse } from "@/lib/course-lifecycle.functions";
import { formatDateBerlin } from "@/lib/format";

type C = { id: string; name: string; starts_on: string | null; start_tentative?: boolean };

export function CourseLifecycleActions({ course, onDone }: { course: C; onDone: () => void | Promise<void> }) {
  const rescheduleFn = useServerFn(rescheduleCourse);
  const cancelFn = useServerFn(cancelCourse);
  const [mode, setMode] = useState<null | "move" | "cancel">(null);
  const [date, setDate] = useState("");
  const [text, setText] = useState("");
  const [notify, setNotify] = useState(true);
  const [keepTentative, setKeepTentative] = useState(false);
  const [busy, setBusy] = useState(false);

  function open(m: "move" | "cancel") {
    setMode(m); setDate(course.starts_on ?? ""); setNotify(true); setKeepTentative(false);
    setText(m === "cancel"
      ? "Leider haben sich für diesen Kurs nicht genügend Teilnehmende angemeldet."
      : "Die Wiedereröffnung des Bades verzögert sich.");
  }

  async function submit() {
    setBusy(true);
    try {
      if (mode === "move") {
        if (!date) throw new Error("Bitte neues Startdatum wählen");
        const r = await rescheduleFn({ data: { courseId: course.id, newStart: date, note: text, notify, keepTentative } });
        toast.success(`Kurstermine verschoben${notify ? ` · ${r.sent} E-Mail(s) verschickt` : ""}`);
      } else {
        const r = await cancelFn({ data: { courseId: course.id, reason: text, notify } });
        toast.success(`Kurs abgesagt · ${r.moved} Kind(er) zurück auf der Warteliste${notify ? ` · ${r.sent} E-Mail(s)` : ""}`);
        if (r.paidCount > 0) toast.info(`${r.paidCount} Familie(n) hatten bereits bezahlt – bitte Erstattung anweisen.`);
      }
      setMode(null); await onDone();
    } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <Button variant="ghost" size="sm" title="Starttermin anpassen" onClick={() => open("move")}><CalendarClock className="h-4 w-4" /></Button>
      <Button variant="ghost" size="sm" title="Kurs absagen" onClick={() => open("cancel")}><Ban className="h-4 w-4 text-destructive" /></Button>
      <Dialog open={mode !== null} onOpenChange={o => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{mode === "move" ? "Starttermin anpassen" : "Kurs vor Beginn absagen"}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="font-medium">{course.name}{course.starts_on ? ` · bisher ${formatDateBerlin(course.starts_on)}` : ""}</p>
            {mode === "move" ? (<>
              <div><Label>Neues Startdatum</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
              <p className="text-xs text-muted-foreground">Alle Kurstage werden um denselben Abstand verschoben. Buchungen und Zahlungen bleiben bestehen.</p>
              <label className="flex items-center gap-2"><Checkbox checked={keepTentative} onCheckedChange={v => setKeepTentative(!!v)} /> Termin weiterhin unter Vorbehalt</label>
            </>) : (
              <p className="text-xs text-muted-foreground">Alle Kinder kommen mit ihrem ursprünglichen Anmeldedatum zurück auf die Warteliste. Der Kurs wird von der Webseite genommen und archiviert. Bereits gezahlte Beiträge müsst ihr selbst zurücküberweisen.</p>
            )}
            <div><Label>Text für die Eltern</Label><Textarea rows={3} value={text} onChange={e => setText(e.target.value)} /></div>
            <label className="flex items-center gap-2"><Checkbox checked={notify} onCheckedChange={v => setNotify(!!v)} /> Eltern per E-Mail informieren</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Abbrechen</Button>
            <Button variant={mode === "cancel" ? "destructive" : "default"} disabled={busy} onClick={submit}>
              {busy ? "Bitte warten…" : mode === "move" ? "Verschieben" : "Kurs absagen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
