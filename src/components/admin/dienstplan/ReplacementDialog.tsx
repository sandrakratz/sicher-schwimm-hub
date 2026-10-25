import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { applyAssignments, requestReplacement } from "@/lib/dienstplan.functions";
import {
  gapOf,
  indexPlan,
  rankCandidates,
  sessionLabel,
  type CandidateState,
  type PlanData,
  type PlanSession,
} from "@/lib/dienstplan";

const STATE_LABEL: Record<CandidateState, { text: string; cls: string }> = {
  yes: { text: "kann", cls: "border-transparent bg-green-600 text-white" },
  open: { text: "nicht gefragt", cls: "" },
  conflict: { text: "gleichzeitig eingeteilt", cls: "border-amber-500 text-amber-700" },
  declined: { text: "kann nicht", cls: "border-destructive text-destructive" },
  blocked: { text: "Sperrzeit", cls: "border-destructive text-destructive" },
};

/** Wer kann diesen Termin übernehmen? Sortiert nach Zusage, Auslastung und Konflikten. */
export function ReplacementDialog({
  session,
  data,
  onClose,
  onChanged,
}: {
  session: PlanSession | null;
  data: PlanData;
  onClose: () => void;
  onChanged: () => void;
}) {
  const apply = useServerFn(applyAssignments);
  const request = useServerFn(requestReplacement);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [initFor, setInitFor] = useState<string | null>(null);

  const ix = useMemo(() => indexPlan(data), [data]);
  const candidates = useMemo(
    () => (session ? rankCandidates(data, ix, session) : []),
    [data, ix, session],
  );

  // Vorauswahl: alle, die zugesagt haben oder noch nicht gefragt wurden
  if (session && initFor !== session.id) {
    setInitFor(session.id);
    setSelected(
      new Set(
        candidates.filter((c) => c.state === "yes" || c.state === "open").map((c) => c.trainer.id),
      ),
    );
    setNote("");
  }

  const gap = session ? gapOf(ix, session) : 0;
  const team = session ? [...(ix.teamBySession.get(session.id) ?? [])] : [];

  async function assign(trainerId: string) {
    if (!session) return;
    setBusy(true);
    try {
      const res = await apply({
        data: { changes: [{ sessionId: session.id, trainerId, on: true }], notify: true },
      });
      const name = ix.trainerById.get(trainerId)?.name ?? "Trainer:in";
      toast.success(`${name} eingeteilt${res.mailed ? " und per Mail informiert" : ""}`);
      onChanged();
      if (gap <= 1) onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Einteilen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function ask() {
    if (!session || selected.size === 0) return;
    setBusy(true);
    try {
      const res = await request({
        data: {
          sessionId: session.id,
          trainerIds: [...selected],
          note: note.trim() || undefined,
        },
      });
      toast.success(`${res.mailed} Mail(s) mit der Ersatzanfrage verschickt`);
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Anfrage fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!session} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {session && (
          <>
            <DialogHeader>
              <DialogTitle>Wer kann einspringen?</DialogTitle>
              <DialogDescription>
                {sessionLabel(session)}
                {session.location ? ` · ${session.location}` : ""}
                <br />
                Es fehlen noch <b>{gap}</b> von {session.needed}. Bereits eingeteilt:{" "}
                {team.length
                  ? team.map((id) => ix.trainerById.get(id)?.name ?? "?").join(", ")
                  : "niemand"}
              </DialogDescription>
            </DialogHeader>

            <div className="divide-y rounded-md border">
              {candidates.map((c) => {
                const st = STATE_LABEL[c.state];
                const askable = c.state === "yes" || c.state === "open";
                return (
                  <div key={c.trainer.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
                    <Checkbox
                      checked={selected.has(c.trainer.id)}
                      onCheckedChange={(v) =>
                        setSelected((prev) => {
                          const n = new Set(prev);
                          if (v) n.add(c.trainer.id);
                          else n.delete(c.trainer.id);
                          return n;
                        })
                      }
                      aria-label={`${c.trainer.name} anfragen`}
                    />
                    <span className="min-w-36 font-medium">{c.trainer.name}</span>
                    <Badge variant="outline" className={st.cls}>
                      {st.text}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {askable ? "" : `${c.hint} · `}
                      {c.load} Einsätze im Monat
                    </span>
                    <Button
                      size="sm"
                      variant={askable ? "default" : "outline"}
                      className="ml-auto h-7"
                      disabled={busy}
                      onClick={() => void assign(c.trainer.id)}
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Einteilen
                    </Button>
                  </div>
                );
              })}
              {candidates.length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">Keine weiteren Personen.</div>
              )}
            </div>

            <div className="space-y-2 rounded-md bg-muted/40 p-3 text-sm">
              <div className="font-medium">Mehrere gleichzeitig anfragen</div>
              <p className="text-xs text-muted-foreground">
                Die Haken oben bestimmen, wer eine Mail bekommt. Wer zuerst im Trainerbereich „Ich
                übernehme“ klickt, ist eingeteilt; du wirst dann informiert.
              </p>
              <Input
                placeholder="Optionaler Hinweis in der Mail (z. B. „kurzfristig, bitte bis morgen“)"
                value={note}
                maxLength={300}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button size="sm" disabled={busy || selected.size === 0} onClick={() => void ask()}>
                <Mail className="h-4 w-4" /> Ersatz anfragen ({selected.size})
              </Button>
              {session.replacementRequestedAt && (
                <p className="text-xs text-muted-foreground">
                  Bereits angefragt am{" "}
                  {new Date(session.replacementRequestedAt).toLocaleDateString("de-DE")}.
                </p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
