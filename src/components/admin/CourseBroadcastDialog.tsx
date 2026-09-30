import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { broadcastCourseMessage } from "@/lib/course-lifecycle.functions";
import { countCoursePush } from "@/lib/push.functions";

const PRESETS = [
  { label: "Termin fällt aus", subject: "Kurstermin heute fällt aus", message: "leider muss der heutige Kurstermin kurzfristig ausfallen. Einen Ersatztermin teilen wir Ihnen so bald wie möglich mit.\n\nWir bitten um Ihr Verständnis." },
  { label: "Bad geschlossen", subject: "Schwimmbad vorübergehend nicht nutzbar", message: "das Schwimmbad ist aus technischen Gründen (bzw. wegen zu geringer Wassertemperatur) vorübergehend nicht nutzbar. Der Kurstermin findet daher nicht statt. Wir melden uns mit einem Nachholtermin." },
  { label: "Nachholtermin", subject: "Nachholtermin für unseren Schwimmkurs", message: "der ausgefallene Kurstermin wird nachgeholt am: [Datum, Uhrzeit].\n\nOrt und Ablauf bleiben wie gewohnt." },
  { label: "Freier Text", subject: "", message: "" },
];

export function CourseBroadcastDialog({ course, onClose }: { course: { id: string; name: string } | null; onClose: () => void }) {
  const send = useServerFn(broadcastCourseMessage);
  const countPush = useServerFn(countCoursePush);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [pushCount, setPushCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!course) return;
    setSubject(""); setMessage(""); setCount(null); setPushCount(null);
    countPush({ data: { courseId: course.id } }).then((r) => setPushCount(r.families)).catch(() => setPushCount(null));
    supabase.from("course_participants").select("participant_email").eq("course_id", course.id).eq("status", "confirmed")
      .then(({ data }) => {
        const set = new Set((data || []).map((d: any) => d.participant_email?.trim().toLowerCase()).filter(Boolean));
        setCount(set.size);
      });
  }, [course]);

  async function submit() {
    if (!course) return;
    if (subject.trim().length < 3 || message.trim().length < 5) return toast.error("Bitte Betreff und Nachricht ausfüllen");
    if (!window.confirm(`Nachricht jetzt an ${count ?? "alle"} Eltern senden?`)) return;
    setBusy(true);
    try {
      const r = await send({ data: { courseId: course.id, subject, message } });
      toast.success(`Nachricht an ${r.sent} von ${r.total} Eltern per E-Mail gesendet, ${r.pushSent} Handys per Mitteilung erreicht`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Senden fehlgeschlagen");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={!!course} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Eilnachricht an Kurs</DialogTitle>
          <DialogDescription>
            {course?.name} · {count == null ? "…" : `${count} Eltern per E-Mail erreichbar`}
            {count != null && pushCount != null && ` · ${pushCount} von ${count} Familien zusätzlich per Handy-Mitteilung erreichbar`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button key={p.label} type="button" variant="outline" size="sm" onClick={() => { setSubject(p.subject); setMessage(p.message); }}>{p.label}</Button>
          ))}
        </div>
        <div className="space-y-3">
          <div><Label>Betreff</Label><Input value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} /></div>
          <div>
            <Label>Nachricht (beginnt nach „Liebe Eltern,“)</Label>
            <Textarea rows={7} value={message} maxLength={4000} onChange={(e) => setMessage(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button variant="destructive" disabled={busy || !count} onClick={submit}>{busy ? "Sende…" : "Jetzt senden"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
