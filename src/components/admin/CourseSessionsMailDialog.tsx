import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  previewCourseSessionsMail,
  sendCourseSessionsMail,
} from "@/lib/course-lifecycle.functions";

type Preview = { sessions: number; recipients: number; skipped: number; total: number };

export function CourseSessionsMailDialog({
  course,
  onClose,
}: {
  course: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const previewFn = useServerFn(previewCourseSessionsMail);
  const sendFn = useServerFn(sendCourseSessionsMail);
  const [info, setInfo] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!course) return;
    setInfo(null);
    setError(null);
    previewFn({ data: { courseId: course.id } })
      .then(setInfo)
      .catch((e) => setError(e instanceof Error ? e.message : "Konnte nicht geladen werden"));
  }, [course, previewFn]);

  async function submit() {
    if (!course || !info) return;
    setBusy(true);
    try {
      const r = await sendFn({ data: { courseId: course.id } });
      toast.success(
        `Terminübersicht an ${r.sent} von ${r.sent + r.failed} Familien gesendet` +
          (r.failed ? ` – ${r.failed} nicht zugestellt (siehe E-Mail-Protokoll)` : ""),
      );
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Senden fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  const noSessions = info != null && info.sessions === 0;

  return (
    <Dialog open={!!course} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Kurstermine per E-Mail nachsenden</DialogTitle>
          <DialogDescription>{course?.name}</DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !info ? (
          <p className="text-sm text-muted-foreground">Wird geprüft…</p>
        ) : noSessions ? (
          <p className="text-sm text-destructive">
            Für diesen Kurs sind noch keine Einzeltermine angelegt. Bitte zuerst unter „Termine“
            eintragen, dann kann die Übersicht verschickt werden.
          </p>
        ) : (
          <div className="space-y-2 text-sm">
            <p>
              Die Eltern bekommen eine Mail mit allen <strong>{info.sessions} Terminen</strong>, dem
              Kalenderlink und den Absage-/Umbuchungsfristen.
            </p>
            <p>
              Empfänger: <strong>{info.recipients}</strong> von {info.total} Familien.
              {info.skipped > 0 &&
                ` ${info.skipped} Familien haben die Terminliste schon in einer früheren Mail erhalten und werden übersprungen.`}
            </p>
            {info.recipients === 0 && (
              <p className="text-muted-foreground">Es gibt niemanden, der noch etwas bekommt.</p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button disabled={busy || !info || noSessions || info.recipients === 0} onClick={submit}>
            {busy ? "Sende…" : `Jetzt an ${info?.recipients ?? "…"} Familien senden`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
